// Package routecontract discovers the source-registered HTTP API surface.
package routecontract

import (
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Operation is a source-level route registration. Runtime conditions describe
// dependencies required for the route to be mounted, not observed availability.
type Operation struct {
	Method            string   `json:"method"`
	Path              string   `json:"path"`
	Handler           string   `json:"handler"`
	Family            string   `json:"family"`
	Guards            []string `json:"guards"`
	RuntimeConditions []string `json:"runtimeConditions"`
	RegistrationCount int      `json:"sourceRegistrationCount"`
}

var routeMethods = map[string]bool{
	"Get": true, "Post": true, "Put": true, "Patch": true, "Delete": true, "Method": true,
}

// Discover parses the authoritative Go router registration source. Dynamic
// paths fail discovery so a new route cannot silently escape contract review.
func Discover(serverPath string) ([]Operation, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, serverPath, nil, 0)
	if err != nil {
		return nil, fmt.Errorf("parse router: %w", err)
	}
	lists, err := packageStringLists(fset, filepath.Dir(serverPath))
	if err != nil {
		return nil, err
	}
	for _, decl := range file.Decls {
		fn, ok := decl.(*ast.FuncDecl)
		if !ok || fn.Name.Name != "NewRouter" {
			continue
		}
		var operations []Operation
		handled := make(map[token.Pos]bool)
		if err := scanBlock(fset, fn.Body, scanContext{lists: lists, handled: handled}, &operations); err != nil {
			return nil, err
		}
		if err := checkRouterCalls(fset, fn.Body, handled); err != nil {
			return nil, err
		}
		// Preserve source order for duplicates: Chi's last registration wins.
		sort.SliceStable(operations, func(i, j int) bool {
			if operations[i].Path == operations[j].Path {
				return operations[i].Method < operations[j].Method
			}
			return operations[i].Path < operations[j].Path
		})
		unique := make([]Operation, 0, len(operations))
		seen := make(map[string]int, len(operations))
		for _, operation := range operations {
			key := operation.Method + " " + operation.Path
			if index, exists := seen[key]; exists {
				if unique[index].Handler != operation.Handler {
					return nil, fmt.Errorf("conflicting source route %s", key)
				}
				unique[index].RegistrationCount++
				unique[index].RuntimeConditions = append(unique[index].RuntimeConditions, "additional source registration: "+strings.Join(operation.RuntimeConditions, " && "))
				continue
			}
			operation.RegistrationCount = 1
			seen[key] = len(unique)
			unique = append(unique, operation)
		}
		return unique, nil
	}
	return nil, fmt.Errorf("NewRouter not found in %s", filepath.Base(serverPath))
}

type scanContext struct {
	guards     []string
	conditions []string
	values     map[string]string
	lists      map[string][]string
	handled    map[token.Pos]bool
}

func scanBlock(fset *token.FileSet, block *ast.BlockStmt, context scanContext, operations *[]Operation) error {
	for _, statement := range block.List {
		if err := scanStatement(fset, statement, context, operations); err != nil {
			return err
		}
	}
	return nil
}

func scanStatement(fset *token.FileSet, statement ast.Stmt, context scanContext, operations *[]Operation) error {
	switch value := statement.(type) {
	case *ast.BlockStmt:
		return scanBlock(fset, value, context, operations)
	case *ast.IfStmt:
		condition := expression(fset, value.Cond)
		if err := scanBlock(fset, value.Body, withCondition(context, condition), operations); err != nil {
			return err
		}
		if value.Else != nil {
			return scanStatement(fset, value.Else, withCondition(context, "else: "+condition), operations)
		}
	case *ast.ForStmt:
		return scanBlock(fset, value.Body, withCondition(context, "loop: "+expression(fset, value.Cond)), operations)
	case *ast.RangeStmt:
		name, ok := value.X.(*ast.Ident)
		binding, bound := value.Value.(*ast.Ident)
		if !ok || !bound {
			if !bound {
				return fmt.Errorf("unresolved route loop %q requires explicit extractor support", expression(fset, value))
			}
			values, literal := stringList(value.X)
			if !literal {
				return fmt.Errorf("unresolved route loop %q requires explicit extractor support", expression(fset, value))
			}
			return scanRouteLoop(fset, value.Body, context, operations, binding.Name, "literal", values)
		}
		values := context.lists[name.Name]
		if len(values) == 0 {
			return fmt.Errorf("unresolved route loop %q requires explicit extractor support", expression(fset, value))
		}
		return scanRouteLoop(fset, value.Body, context, operations, binding.Name, name.Name, values)
	case *ast.ExprStmt:
		call, ok := value.X.(*ast.CallExpr)
		if !ok {
			return nil
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return nil
		}
		if selector.Sel.Name == "Use" && len(call.Args) == 1 && expression(fset, selector.X) == "r" && len(context.conditions) == 0 {
			context.handled[call.Pos()] = true // Global middleware on the root router.
		}
		if selector.Sel.Name == "Group" && len(call.Args) == 1 {
			if group, ok := call.Args[0].(*ast.FuncLit); ok {
				context.handled[call.Pos()] = true
				groupContext := context
				groupContext.guards = append(copyStrings(context.guards), receiverGuards(fset, selector.X)...)
				groupContext.guards = append(groupContext.guards, directGuards(fset, group.Body, context.handled)...)
				return scanBlock(fset, group.Body, groupContext, operations)
			}
		}
		if !routeMethods[selector.Sel.Name] || len(call.Args) < 2 {
			return nil
		}
		context.handled[call.Pos()] = true
		method := strings.ToUpper(selector.Sel.Name)
		pathArg, handlerArg := 0, 1
		if selector.Sel.Name == "Method" {
			if len(call.Args) < 3 {
				return fmt.Errorf("route Method call needs method, path, and handler")
			}
			var methodOK bool
			method, methodOK = httpMethod(call.Args[0])
			if !methodOK {
				return fmt.Errorf("unresolved route HTTP method %q", expression(fset, call.Args[0]))
			}
			pathArg, handlerArg = 1, 2
		}
		path, ok := stringValue(call.Args[pathArg], context.values)
		if !ok {
			return fmt.Errorf("dynamic route path %q requires explicit extractor support", expression(fset, call.Args[pathArg]))
		}
		if path != "/api" && !strings.HasPrefix(path, "/api/") {
			return nil
		}
		guards := append(copyStrings(context.guards), receiverGuards(fset, selector.X)...)
		*operations = append(*operations, Operation{
			Method:            method,
			Path:              path,
			Handler:           expression(fset, call.Args[handlerArg]),
			Family:            family(path),
			Guards:            guards,
			RuntimeConditions: copyStrings(context.conditions),
		})
	}
	return nil
}

// Fail closed on router registration styles not modeled by the extractor.
// shortcut: only NewRouter's directly registered /api routes are supported;
// extend scanning when router registrations move to helpers or mounted subrouters.
func checkRouterCalls(fset *token.FileSet, body *ast.BlockStmt, handled map[token.Pos]bool) error {
	routers := map[string]bool{"r": true}
	aliases := make(map[string]bool)
	ast.Inspect(body, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if !ok || selector.Sel.Name != "Group" || len(call.Args) != 1 {
			return true
		}
		if callback, ok := call.Args[0].(*ast.FuncLit); ok && callback.Type.Params != nil {
			for _, field := range callback.Type.Params.List {
				for _, name := range field.Names {
					routers[name.Name] = true
				}
			}
		}
		return true
	})
	// Propagate router aliases before checking calls, including chained aliases.
	for changed := true; changed; {
		changed = false
		addAlias := func(target, source ast.Expr) {
			name, ok := target.(*ast.Ident)
			if ok && !routers[name.Name] && routerReceiver(source, routers) {
				routers[name.Name] = true
				aliases[name.Name] = true
				changed = true
			}
		}
		ast.Inspect(body, func(node ast.Node) bool {
			switch stmt := node.(type) {
			case *ast.AssignStmt:
				if len(stmt.Lhs) == len(stmt.Rhs) {
					for i := range stmt.Lhs {
						addAlias(stmt.Lhs[i], stmt.Rhs[i])
					}
				}
			case *ast.ValueSpec:
				if len(stmt.Names) == len(stmt.Values) {
					for i, name := range stmt.Names {
						addAlias(name, stmt.Values[i])
					}
				}
			}
			return true
		})
	}
	var problem error
	ast.Inspect(body, func(node ast.Node) bool {
		if problem != nil {
			return false
		}
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		if selector, ok := call.Fun.(*ast.SelectorExpr); ok {
			if routerReceiver(selector.X, routers) {
				name := selector.Sel.Name
				if routerReceiver(selector.X, aliases) {
					problem = fmt.Errorf("unsupported router registration through alias %s", expression(fset, call))
					return false
				}
				switch {
				case routeMethods[name] || name == "Group":
					if !handled[call.Pos()] {
						problem = fmt.Errorf("unsupported router registration %s at %s", expression(fset, call), fset.Position(call.Pos()))
					}
				case name == "Use":
					if len(call.Args) != 1 {
						problem = fmt.Errorf("unsupported router middleware registration %s", expression(fset, call))
					} else if !handled[call.Pos()] {
						problem = fmt.Errorf("conditional or indirect middleware registration not inspected: %s", expression(fset, call))
					}
				case name == "With":
					// Its parent Group or HTTP registration must be visited.
				case name == "Handle" || name == "HandleFunc" || name == "MethodFunc" || name == "Head" || name == "Options" || name == "Connect" || name == "Trace" || name == "Route" || name == "Mount":
					problem = fmt.Errorf("unsupported router registration %s", expression(fset, call))
				}
			}
		}
		for _, arg := range call.Args {
			if ident, ok := arg.(*ast.Ident); ok && routers[ident.Name] {
				if expression(fset, call.Fun) != "realtime.MountRoutes" {
					problem = fmt.Errorf("uninspected router helper %s", expression(fset, call))
				}
				break
			}
		}
		return true
	})
	return problem
}

func routerReceiver(expr ast.Expr, routers map[string]bool) bool {
	if ident, ok := expr.(*ast.Ident); ok {
		return routers[ident.Name]
	}
	if call, ok := expr.(*ast.CallExpr); ok {
		if selector, ok := call.Fun.(*ast.SelectorExpr); ok && selector.Sel.Name == "With" {
			return routerReceiver(selector.X, routers)
		}
	}
	return false
}

func httpMethod(expression ast.Expr) (string, bool) {
	selector, ok := expression.(*ast.SelectorExpr)
	if !ok {
		return "", false
	}
	const prefix = "Method"
	if !strings.HasPrefix(selector.Sel.Name, prefix) {
		return "", false
	}
	method := strings.TrimPrefix(selector.Sel.Name, prefix)
	switch method {
	case "Get", "Post", "Put", "Patch", "Delete", "Head", "Options", "Trace":
		return strings.ToUpper(method), true
	default:
		return "", false
	}
}

func scanRouteLoop(fset *token.FileSet, block *ast.BlockStmt, context scanContext, operations *[]Operation, binding, source string, values []string) error {
	for _, loopValue := range values {
		loopContext := withCondition(context, "range: "+source)
		loopContext.values = copyMap(context.values)
		loopContext.values[binding] = loopValue
		if err := scanBlock(fset, block, loopContext, operations); err != nil {
			return err
		}
	}
	return nil
}

func directGuards(fset *token.FileSet, block *ast.BlockStmt, handled map[token.Pos]bool) []string {
	var guards []string
	for _, statement := range block.List {
		expressionStatement, ok := statement.(*ast.ExprStmt)
		if !ok {
			continue
		}
		call, ok := expressionStatement.X.(*ast.CallExpr)
		if !ok || len(call.Args) != 1 {
			continue
		}
		selector, ok := call.Fun.(*ast.SelectorExpr)
		if ok && selector.Sel.Name == "Use" {
			handled[call.Pos()] = true
			guards = append(guards, expression(fset, call.Args[0]))
		}
	}
	return guards
}

func withCondition(context scanContext, condition string) scanContext {
	context.conditions = append(copyStrings(context.conditions), condition)
	return context
}

func stringValue(expression ast.Expr, values map[string]string) (string, bool) {
	literal, ok := expression.(*ast.BasicLit)
	if ok && literal.Kind == token.STRING {
		value, err := strconv.Unquote(literal.Value)
		return value, err == nil
	}
	if identifier, ok := expression.(*ast.Ident); ok {
		value, exists := values[identifier.Name]
		return value, exists
	}
	if binary, ok := expression.(*ast.BinaryExpr); ok && binary.Op == token.ADD {
		left, leftOK := stringValue(binary.X, values)
		right, rightOK := stringValue(binary.Y, values)
		return left + right, leftOK && rightOK
	}
	return "", false
}

func receiverGuards(fset *token.FileSet, receiver ast.Expr) []string {
	call, ok := receiver.(*ast.CallExpr)
	if !ok {
		return nil
	}
	selector, ok := call.Fun.(*ast.SelectorExpr)
	if !ok || selector.Sel.Name != "With" || len(call.Args) == 0 {
		return nil
	}
	guards := receiverGuards(fset, selector.X)
	for _, arg := range call.Args {
		guards = append(guards, expression(fset, arg))
	}
	return guards
}

func packageStringLists(fset *token.FileSet, directory string) (map[string][]string, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, fmt.Errorf("read route package: %w", err)
	}
	lists := make(map[string][]string)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".go") || strings.HasSuffix(entry.Name(), "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, filepath.Join(directory, entry.Name()), nil, 0)
		if err != nil {
			return nil, err
		}
		for _, declaration := range file.Decls {
			general, ok := declaration.(*ast.GenDecl)
			if !ok || general.Tok != token.VAR {
				continue
			}
			for _, spec := range general.Specs {
				value, ok := spec.(*ast.ValueSpec)
				if !ok || len(value.Names) != 1 || len(value.Values) != 1 {
					continue
				}
				if values, ok := stringList(value.Values[0]); ok {
					lists[value.Names[0].Name] = values
				}
			}
		}
	}
	return lists, nil
}

func stringList(expression ast.Expr) ([]string, bool) {
	composite, ok := expression.(*ast.CompositeLit)
	if !ok {
		return nil, false
	}
	values := make([]string, 0, len(composite.Elts))
	for _, element := range composite.Elts {
		value, ok := stringValue(element, nil)
		if !ok {
			return nil, false
		}
		values = append(values, value)
	}
	return values, true
}

func expression(fset *token.FileSet, node ast.Node) string {
	if node == nil {
		return ""
	}
	var buffer bytes.Buffer
	_ = printer.Fprint(&buffer, fset, node)
	return buffer.String()
}

func family(path string) string {
	parts := strings.Split(strings.TrimPrefix(path, "/api/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "Other"
	}
	if parts[0] == "admin" {
		if len(parts) > 1 {
			return "Admin / " + strings.ReplaceAll(parts[1], "-", " ")
		}
		return "Admin"
	}
	names := map[string]string{
		"auth": "Authentication", "content": "Content", "search": "Search", "levels": "Levels",
		"flashcards": "Flashcards", "exercises": "Exercises", "quiz": "Examinations",
		"bookmarks": "Bookmarks", "media": "Media", "notifications": "Notifications",
		"analytics": "Analytics", "gamification": "Gamification", "profile": "Profile",
	}
	if name, ok := names[parts[0]]; ok {
		return name
	}
	return strings.ReplaceAll(parts[0], "-", " ")
}

func copyStrings(values []string) []string {
	return append([]string(nil), values...)
}

func copyMap(values map[string]string) map[string]string {
	result := make(map[string]string, len(values)+1)
	for key, value := range values {
		result[key] = value
	}
	return result
}
