package main

import (
	"fmt"
	"os"

	"github.com/kotobawork/nihongo-bjt/api-go/internal/credential"
)

// genadminhash prints the Argon2id PHC hash of the password given as the only
// argument. There is deliberately no default password.
func main() {
	if len(os.Args) != 2 || os.Args[1] == "" {
		fmt.Fprintln(os.Stderr, "usage: genadminhash <password>")
		os.Exit(2)
	}
	encoded, err := credential.Hash([]byte(os.Args[1]), credential.DefaultParams())
	if err != nil {
		fmt.Fprintf(os.Stderr, "hash error: %v\n", err)
		os.Exit(1)
	}
	fmt.Println(encoded)
}
