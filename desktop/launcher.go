package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"
)

func main() {
	dir := gameRoot()
	if err := os.Chdir(dir); err != nil {
		fail(err)
	}
	if _, err := look("node"); err != nil {
		fmt.Println("Node.js kurulu degil. Oyun bunu gerektirir.")
		fmt.Println("Tarayicida nodejs.org aciliyor. LTS surumunu kurup bu dosyayi yeniden acin.")
		open("https://nodejs.org/tr/download")
		wait()
		os.Exit(1)
	}
	if _, err := os.Stat(filepath.Join(dir, "node_modules")); err != nil {
		fmt.Println("Ilk acilis. Paketler indiriliyor, bu birkac dakika surebilir...")
		if err := run("npm", "install"); err != nil {
			fmt.Println("Kurulum basarisiz. Internet baglantinizi kontrol edip yeniden deneyin.")
			fmt.Println(err)
			wait()
			os.Exit(1)
		}
	}
	fmt.Println("Abis: Sonsuz Gece basliyor. Tarayici birazdan acilacak.")
	fmt.Println("Kapatmak icin bu pencereyi kapatin.")
	go func() {
		time.Sleep(6 * time.Second)
		open("http://127.0.0.1:8080")
	}()
	if err := run("npm", "run", "dev"); err != nil {
		fmt.Println(err)
		wait()
		os.Exit(1)
	}
}

func gameRoot() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	dir := filepath.Dir(exe)
	if _, err := os.Stat(filepath.Join(dir, "package.json")); err == nil {
		return dir
	}
	parent := filepath.Dir(dir)
	if _, err := os.Stat(filepath.Join(parent, "package.json")); err == nil {
		return parent
	}
	return dir
}

func look(name string) (string, error) {
	if runtime.GOOS == "windows" {
		if path, err := exec.LookPath(name + ".cmd"); err == nil {
			return path, nil
		}
	}
	return exec.LookPath(name)
}

func run(name string, args ...string) error {
	if runtime.GOOS == "windows" {
		cmdArgs := append([]string{"/c", name}, args...)
		cmd := exec.Command("cmd", cmdArgs...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		cmd.Stdin = os.Stdin
		return cmd.Run()
	}
	bin, err := look(name)
	if err != nil {
		return err
	}
	cmd := exec.Command(bin, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

func open(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}

func fail(err error) {
	fmt.Println(err)
	wait()
	os.Exit(1)
}

func wait() {
	fmt.Println("Kapatmak icin Enter...")
	_, _ = fmt.Scanln()
}
