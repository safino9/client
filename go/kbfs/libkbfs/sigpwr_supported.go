// +build linux netbsd
// see files in https://golang.org/src/syscall/ starting with "zerrors_" for support

package libkbfs

import "syscall"

const SIGPWR = syscall.SIGPWR
