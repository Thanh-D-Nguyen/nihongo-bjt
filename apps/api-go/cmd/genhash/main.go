package main

import (
	"crypto/rand"
	"fmt"

	"golang.org/x/crypto/argon2"
)

func main() {
	salt := make([]byte, 16)
	rand.Read(salt)
	hash := argon2.IDKey([]byte("StagingTest2026!"), salt, 3, 65536, 2, 32)
	fmt.Println("SALT_HEX=" + fmt.Sprintf("%x", salt))
	fmt.Println("HASH_HEX=" + fmt.Sprintf("%x", hash))
}
