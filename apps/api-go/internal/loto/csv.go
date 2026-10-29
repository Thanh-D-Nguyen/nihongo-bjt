package loto

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/japanese"
	"golang.org/x/text/transform"
)

// headerAliases maps the Japanese headers of the thekyo CSV (and common
// English spellings) to internal column keys. Keys are lower-cased.
var headerAliases = map[string]string{
	"開催回": "drawnumber", "回号": "drawnumber", "drawnumber": "drawnumber", "draw_number": "drawnumber", "round": "drawnumber",
	"日付": "drawdate", "抽せん日": "drawdate", "drawdate": "drawdate", "draw_date": "drawdate", "date": "drawdate",
	"第1数字": "n1", "第2数字": "n2", "第3数字": "n3", "第4数字": "n4", "第5数字": "n5", "第6数字": "n6", "第7数字": "n7",
	"bonus数字": "bonus1", "bonus数字1": "bonus1", "bonus数字2": "bonus2",
	"bonus": "bonus1", "bonus1": "bonus1", "bonus2": "bonus2",
	"キャリーオーバー": "carryover", "carryoveramount": "carryover", "carryover_amount": "carryover",
	"salesamount": "sales", "sales_amount": "sales",
	"sourceurl": "sourceurl", "source_url": "sourceurl",
	"game": "game",
}

// DecodeCSVBytes converts raw CSV bytes to UTF-8. thekyo serves Shift_JIS;
// bytes that already form valid UTF-8 (admin uploads) are returned unchanged.
func DecodeCSVBytes(raw []byte) (string, error) {
	raw = bytes.TrimPrefix(raw, []byte{0xEF, 0xBB, 0xBF})
	if utf8.Valid(raw) {
		return string(raw), nil
	}
	decoded, _, err := transform.Bytes(japanese.ShiftJIS.NewDecoder(), raw)
	if err != nil {
		return "", fmt.Errorf("%w: decode Shift_JIS: %v", ErrInvalidInput, err)
	}
	return string(decoded), nil
}

// ParseCSV parses a Loto6/Loto7 results CSV into validated draws, sorted by
// draw number. fallback is used when the CSV does not name its game and the
// header does not reveal it. Every violation names the offending row.
func ParseCSV(text string, fallback Game) ([]Draw, error) {
	draws, rowErrors, err := parseCSV(text, fallback, true)
	if err != nil {
		return nil, err
	}
	if len(rowErrors) > 0 {
		return nil, rowErrors[0]
	}
	return draws, nil
}

// ParseCSVLenient parses like ParseCSV but skips invalid rows instead of
// failing, returning the per-row errors. It is used for the third-party mirror
// so a single corrupt historical row cannot block every sync; the caller must
// still reject a result with no valid rows.
func ParseCSVLenient(text string, fallback Game) ([]Draw, []error, error) {
	return parseCSV(text, fallback, false)
}

func parseCSV(text string, fallback Game, strict bool) ([]Draw, []error, error) {
	var rowErrors []error
	reader := csv.NewReader(strings.NewReader(strings.TrimPrefix(text, "\ufeff")))
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true
	reader.Comment = '#'
	records := make([][]string, 0, 256)
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, nil, fmt.Errorf("%w: %v", ErrInvalidInput, err)
		}
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue
		}
		records = append(records, record)
	}
	if len(records) < 2 {
		return nil, nil, fmt.Errorf("%w: CSV contains no data rows", ErrInvalidInput)
	}

	headers := make([]string, len(records[0]))
	for i, header := range records[0] {
		key := strings.ToLower(strings.TrimSpace(header))
		if alias, ok := headerAliases[key]; ok {
			key = alias
		}
		headers[i] = key
	}
	detected := fallback
	if contains(headers, "n7") {
		detected = Loto7
	} else if contains(headers, "n6") {
		detected = Loto6
	}

	draws := make([]Draw, 0, len(records)-1)
	seen := make(map[string]struct{}, len(records))
	for index, record := range records[1:] {
		rowNumber := index + 2
		row := make(map[string]string, len(headers))
		for i, header := range headers {
			if i < len(record) && header != "" {
				row[header] = strings.TrimSpace(record[i])
			}
		}
		game := detected
		if raw := strings.ToLower(row["game"]); raw != "" {
			parsed, ok := ParseGame(raw)
			if !ok {
				rowErrors = append(rowErrors, fmt.Errorf("%w: row %d: game must be loto6 or loto7", ErrInvalidInput, rowNumber))
				continue
			}
			game = parsed
		}
		if _, ok := ParseGame(string(game)); !ok {
			rowErrors = append(rowErrors, fmt.Errorf("%w: row %d: game must be loto6 or loto7", ErrInvalidInput, rowNumber))
			continue
		}
		draw, err := drawFromRow(SpecFor(game), row)
		if err != nil {
			rowErrors = append(rowErrors, fmt.Errorf("%w: row %d: %v", ErrInvalidInput, rowNumber, err))
			if strict {
				return nil, rowErrors, nil
			}
			continue
		}
		key := fmt.Sprintf("%s:%d", draw.Game, draw.Number)
		if _, dup := seen[key]; dup {
			rowErrors = append(rowErrors, fmt.Errorf("%w: row %d: duplicate draw number %d", ErrInvalidInput, rowNumber, draw.Number))
			if strict {
				return nil, rowErrors, nil
			}
			continue
		}
		seen[key] = struct{}{}
		draws = append(draws, draw)
	}
	sort.SliceStable(draws, func(i, j int) bool { return draws[i].Number < draws[j].Number })
	return draws, rowErrors, nil
}

func drawFromRow(spec Spec, row map[string]string) (Draw, error) {
	number, err := requiredInt(row, "drawnumber")
	if err != nil {
		return Draw{}, err
	}
	dateKey, err := normalizeDate(row["drawdate"])
	if err != nil {
		return Draw{}, err
	}
	main := make([]int, 0, spec.MainCount)
	for i := 1; i <= spec.MainCount; i++ {
		value, err := requiredInt(row, "n"+strconv.Itoa(i))
		if err != nil {
			return Draw{}, err
		}
		main = append(main, value)
	}
	bonus := make([]int, 0, spec.BonusCount)
	for i := 1; i <= spec.BonusCount; i++ {
		value, err := requiredInt(row, "bonus"+strconv.Itoa(i))
		if err != nil {
			return Draw{}, err
		}
		bonus = append(bonus, value)
	}
	draw := Draw{Game: spec.Game, Number: number, DateKey: dateKey, Main: main, Bonus: bonus, Provider: "csv_import", SourceURL: row["sourceurl"]}
	if err := ValidateDraw(&draw); err != nil {
		return Draw{}, err
	}
	if value, ok := optionalAmount(row["carryover"]); ok {
		draw.Carryover = &value
	}
	if value, ok := optionalAmount(row["sales"]); ok {
		draw.Sales = &value
	}
	return draw, nil
}

// ValidateDraw checks counts, ranges and uniqueness against the game rules and
// normalizes the numbers into ascending order.
func ValidateDraw(draw *Draw) error {
	spec, ok := specs[draw.Game]
	if !ok {
		return fmt.Errorf("unknown game %q", draw.Game)
	}
	if draw.Number < 1 {
		return fmt.Errorf("draw number %d must be positive", draw.Number)
	}
	if _, err := ParseDateKey(draw.DateKey); err != nil {
		return err
	}
	if len(draw.Main) != spec.MainCount {
		return fmt.Errorf("%s requires %d main numbers, got %d", spec.Game, spec.MainCount, len(draw.Main))
	}
	if len(draw.Bonus) != spec.BonusCount {
		return fmt.Errorf("%s requires %d bonus numbers, got %d", spec.Game, spec.BonusCount, len(draw.Bonus))
	}
	seen := make(map[int]struct{}, spec.MainCount+spec.BonusCount)
	for _, n := range append(append([]int(nil), draw.Main...), draw.Bonus...) {
		if n < 1 || n > spec.MaxNumber {
			return fmt.Errorf("number %d is outside 1-%d", n, spec.MaxNumber)
		}
		if _, dup := seen[n]; dup {
			return fmt.Errorf("number %d appears more than once", n)
		}
		seen[n] = struct{}{}
	}
	sort.Ints(draw.Main)
	sort.Ints(draw.Bonus)
	return nil
}

func requiredInt(row map[string]string, key string) (int, error) {
	raw, ok := row[key]
	if !ok || raw == "" {
		return 0, fmt.Errorf("missing %s", key)
	}
	value, err := strconv.Atoi(strings.ReplaceAll(strings.TrimSpace(raw), ",", ""))
	if err != nil {
		return 0, fmt.Errorf("%s %q is not a number", key, raw)
	}
	return value, nil
}

func optionalAmount(raw string) (int64, bool) {
	cleaned := strings.NewReplacer(",", "", "_", "", " ", "", "円", "").Replace(raw)
	if cleaned == "" {
		return 0, false
	}
	value, err := strconv.ParseInt(cleaned, 10, 64)
	if err != nil || value < 0 {
		return 0, false
	}
	return value, true
}

// normalizeDate accepts 2000/10/5, 2000-10-05 and 2000.10.05.
func normalizeDate(raw string) (string, error) {
	cleaned := strings.NewReplacer("/", "-", ".", "-").Replace(strings.TrimSpace(raw))
	parts := strings.Split(cleaned, "-")
	if len(parts) != 3 {
		return "", fmt.Errorf("%w: %q must be a date such as 2026/10/26", ErrInvalidDate, raw)
	}
	year, errY := strconv.Atoi(parts[0])
	month, errM := strconv.Atoi(parts[1])
	day, errD := strconv.Atoi(parts[2])
	if errY != nil || errM != nil || errD != nil || len(parts[0]) != 4 {
		return "", fmt.Errorf("%w: %q must be a date such as 2026/10/26", ErrInvalidDate, raw)
	}
	key := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	if _, err := ParseDateKey(key); err != nil {
		return "", err
	}
	return key, nil
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
