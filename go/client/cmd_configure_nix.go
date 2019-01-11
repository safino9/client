// Copyright 2015 Keybase, Inc. All rights reserved. Use of
// this source code is governed by the included BSD license.

// +build !darwin,!windows

package client

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"syscall"

	"github.com/keybase/cli"
	"github.com/keybase/client/go/install"
	"github.com/keybase/client/go/libcmdline"
	"github.com/keybase/client/go/libkb"
)

func NewCmdConfigure(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	return cli.Command{
		Name:         "configure",
		ArgumentHelp: "[arguments...]",
		Subcommands: []cli.Command{
			NewCmdConfigureAutostart(cl, g),
			NewCmdConfigureRedirector(cl, g),
		},
	}
}

type CmdConfigureAutostart struct {
	libkb.Contextified
	ToggleOn bool
}

func NewCmdConfigureAutostart(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdConfigureAutostart{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "autostart",
		Usage: `
Configure autostart settings via the XDG autostart standard.
This creates a file at ~/.config/autostart/keybase.desktop.
If you change this file after initial install, it will not be changed unless you run 'keybase configure autostart' or delete the sentinel file at ~/.config/keybase/autostart_created.

If you are using a headless machine or a minimal window manager that doesn't respect this standard, you will need to configure autostart in another way.
If you are running Keybase on a headless machine using systemd, you may be interested in enabling the systemd user manager units keybase.service and kbfs.service: '$ systemctl --user enable keybase.service kbfs.service'.`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "toggle-on",
				Usage: "Toggle on Keybase, KBFS, and GUI autostart on startup.",
			},
			cli.BoolFlag{
				Name:  "toggle-off",
				Usage: "Toggle off Keybase, KBFS, and GUI autostart on startup.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "autostart", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func (v *CmdConfigureAutostart) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("toggle-on")
	toggleOff := ctx.Bool("toggle-off")
	if toggleOn && toggleOff {
		return fmt.Errorf("Cannot specify both --toggle-on and --toggle-off.")
	}
	if !toggleOn && !toggleOff {
		return fmt.Errorf("Must specify either --toggle-on or --toggle-off.")
	}
	v.ToggleOn = toggleOn
	return nil
}

func (v *CmdConfigureAutostart) Run() error {
	err := install.ToggleAutostart(v.G(), v.ToggleOn, false)
	if err != nil {
		return err
	}
	return nil
}

func (v *CmdConfigureAutostart) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config: true,
		API:    true,
	}
}

type CmdConfigureRedirector struct {
	libkb.Contextified
	ToggleOn            bool
	Status              bool
	RootRedirectorMount string
	RootConfigFilename  string
	RootConfigDirectory string
}

func NewCmdConfigureRedirector(cl *libcmdline.CommandLine, g *libkb.GlobalContext) cli.Command {
	cmd := &CmdConfigureRedirector{
		Contextified: libkb.NewContextified(g),
	}
	return cli.Command{
		Name: "redirector",
		Usage: `

Configure keybase-redirector settings.
This option requires root privileges, and must use the root config file
at /etc/keybase/config.json.

The Keybase redirector allows every user to access KBFS files at /keybase, which
will show different information depending on the requester.

Enabling the root redirector will set suid root on /usr/bin/keybase-redirector,
allowing any user to run it with root privileges. It is enabled by default.

If the redirector is disabled, you can still access your files in
the mount directory given by "$ keybase config get -d -b mountdir", which is
owned by your user, but you won't be able to access your files at /keybase.

More information is available at https://keybase.io/docs/kbfs/understanding_kbfs#mountpoints.

Examples (prepend sudo, if not root):
# keybase --use-root-config-file configure redirector --status
# keybase --use-root-config-file configure redirector --toggle-on
# keybase --use-root-config-file configure redirector --toggle-off`,
		Flags: []cli.Flag{
			cli.BoolFlag{
				Name:  "status",
				Usage: "Print whether the KBFS redirector is enabled or disabled.",
			},
			cli.BoolFlag{
				Name:  "toggle-on",
				Usage: "Toggle on the KBFS redirector.",
			},
			cli.BoolFlag{
				Name:  "toggle-off",
				Usage: "Toggle off the KBFS redirector.",
			},
		},
		ArgumentHelp: "",
		Action: func(c *cli.Context) {
			cl.ChooseCommand(cmd, "redirector", c)
			cl.SetForkCmd(libcmdline.NoFork)
			cl.SetLogForward(libcmdline.LogForwardNone)
		},
	}
}

func xor3(a, b, c bool) (ret bool) {
	ret = ret != a
	ret = ret != b
	ret = ret != c
	return
}

func (v *CmdConfigureRedirector) ParseArgv(ctx *cli.Context) error {
	toggleOn := ctx.Bool("toggle-on")
	toggleOff := ctx.Bool("toggle-off")
	status := ctx.Bool("status")
	if !xor3(toggleOn, toggleOff, status) || (toggleOn && toggleOff && status) {
		return fmt.Errorf("Must specify exactly one of --toggle-on, --toggle-off, --status.")
	}
	v.ToggleOn = toggleOn
	v.Status = status

	return nil
}

func (v *CmdConfigureRedirector) isRedirectorEnabled() (bool, error) {
	config := v.G().Env.GetConfig()
	if config == nil {
		return false, fmt.Errorf("could not get config reader")
	}

	i, err := config.GetInterfaceAtPath(libkb.DisableRootRedirectorConfigKey)
	if err != nil {
		// Config key or file nonexistent, but possibly other errors as well
		return true, nil
	}
	val, ok := i.(bool)
	if !ok {
		return false, fmt.Errorf("config corruption: not a boolean value; please delete the %s key in %s manually.",
			libkb.DisableRootRedirectorConfigKey, v.RootConfigFilename)
	}
	return !val, nil
}

func redirectorPerm(toggleOn bool) uint32 {
	if toggleOn {
		// suid set; octal
		return 04755
	}
	// suid unset; octal
	return 0755
}

func (v *CmdConfigureRedirector) createMount() error {
	rootMountPerm := os.FileMode(0755 | os.ModeDir)
	mountedPerm := os.FileMode(0555 | os.ModeDir) // permissions different when mounted
	fileInfo, err := os.Stat(v.RootRedirectorMount)
	switch {
	case os.IsNotExist(err):
		err := os.Mkdir(v.RootRedirectorMount, rootMountPerm)
		if err != nil {
			v.G().Log.Errorf("Failed to create mountpoint at %s: %s", v.RootRedirectorMount, err)
			v.G().Log.Errorf("If KBFS is not being used, run `# pkill -f keybase-redirector` and try again.")
			return err
		}
		fmt.Println("Redirector mount created.")
	case err == nil:
		v.G().Log.Warning("Root mount already exists; will not re-create.")
		if fileInfo.Mode() != rootMountPerm && fileInfo.Mode() != mountedPerm {
			return fmt.Errorf("Root mount exists at %s, but has incorrect file mode %s. Delete %s and try again.",
				v.RootRedirectorMount, fileInfo.Mode(), v.RootRedirectorMount)
		}
		dir, err := os.Open(v.RootRedirectorMount)
		if err != nil {
			return fmt.Errorf("Root mount exists at %s, but failed to open: %s. Delete %s and try again.", v.RootRedirectorMount, err, v.RootRedirectorMount)
		}
		defer dir.Close()
		_, err = dir.Readdir(1)
		switch err {
		case io.EOF:
			// doesn't fall-through
		case nil:
			return fmt.Errorf("Root mount exists at %s, but is non-empty (is the redirector currently running?). Run `# pkill -f keybase-redirector`, delete directory %s and try again.", v.RootRedirectorMount, v.RootRedirectorMount)
		default:
			return fmt.Errorf("Unexpected error while reading %s: %s", v.RootRedirectorMount, err)
		}
	default:
		v.G().Log.Errorf("Unexpected error while trying to stat mount: %s", err)
		return err
	}
	return nil
}

func (v *CmdConfigureRedirector) deleteMount() error {
	err := os.Remove(v.RootRedirectorMount)
	switch {
	case os.IsNotExist(err):
		v.G().Log.Warning("Root mountdir already nonexistent.")
	case err == nil:
		fmt.Println("Redirector mount deletion successful.")
	default:
		v.G().Log.Errorf("Failed to delete mountpoint at %s: %s", v.RootRedirectorMount, err)
		v.G().Log.Errorf("If KBFS is not being used, run `# pkill -f keybase-redirector`, delete %s and try again.", v.RootRedirectorMount)
		return err
	}
	return nil
}

func (v *CmdConfigureRedirector) tryAtomicallySetConfigAndChmodRedirector(originallyEnabled bool) error {
	configWriter := v.G().Env.GetConfigWriter()
	if configWriter == nil {
		return fmt.Errorf("could not get config writer")
	}

	// By default, writing a config file uses libkb.FilePerm which is only readable by the creator.
	// Since we're writing to the root config file, re-allow other users to read it.
	defer func() {
		os.Chmod(v.RootConfigDirectory, 0755|os.ModeDir)
		os.Chmod(v.RootConfigFilename, 0644)
	}()

	err := configWriter.SetBoolAtPath(libkb.DisableRootRedirectorConfigKey, !v.ToggleOn)
	if err != nil {
		v.G().Log.Errorf("Failed to write to %s. Do you have root privileges?", v.RootConfigFilename)
		return err
	}

	redirectorPath, err := exec.LookPath("keybase-redirector")
	if err != nil {
		v.G().Log.Warning("configuration successful, but keybase-redirector not found in $PATH (it may not be installed), so not updating permissions.")
		return nil
	}

	// os.Chmod doesn't work with suid bit, so use syscall
	err = syscall.Chmod(redirectorPath, redirectorPerm(v.ToggleOn))
	if err != nil {
		// If flipping bit, attempt to restore old config value to maintain consistency between config and redirector mode
		if originallyEnabled != v.ToggleOn {
			configErr := configWriter.SetBoolAtPath(libkb.DisableRootRedirectorConfigKey, !originallyEnabled)
			if configErr != nil {
				v.G().Log.Errorf("Failed to revert config after chmod failure; config may be in inconsistent state.")
				return fmt.Errorf("Error during chmod: %s. Error during config revert: %s.", err, configErr)
			}
		}

		return err
	}

	return nil
}

func (v *CmdConfigureRedirector) configureEnv() error {
	rootRedirectorMount, err := v.G().Env.GetRootRedirectorMount()
	if err != nil {
		return err
	}
	v.RootRedirectorMount = rootRedirectorMount

	rootConfigFilename, err := v.G().Env.GetRootConfigFilename()
	if err != nil {
		return err
	}
	v.RootConfigFilename = rootConfigFilename

	if v.RootConfigFilename != v.G().Env.GetConfigFilename() {
		return fmt.Errorf("Must specify --use-root-config-file to `keybase`.")
	}
	return nil
}

func (v *CmdConfigureRedirector) Run() error {
	// Don't do this setup in ParseArgv because environment variables have not
	// yet been populated then
	err := v.configureEnv()
	if err != nil {
		return err
	}

	rootConfigDirectory, err := v.G().Env.GetRootConfigDirectory()
	if err != nil {
		return err
	}
	v.RootConfigDirectory = rootConfigDirectory
	enabled, err := v.isRedirectorEnabled()
	if err != nil {
		return err
	}

	if v.Status {
		if enabled {
			fmt.Println("enabled")
		} else {
			fmt.Println("disabled")
		}
		return nil
	}

	err = v.tryAtomicallySetConfigAndChmodRedirector(enabled)
	if err != nil {
		return err
	}
	fmt.Println("Redirector configuration updated.")

	if v.ToggleOn {
		err := v.createMount()
		if err != nil {
			return err
		}
		fmt.Println("Please run `$ run_keybase` to start the redirector for each user using KBFS.")
	} else {
		err := v.deleteMount()
		if err != nil {
			return err
		}
		fmt.Println("Please run `# pkill -f keybase-redirector` to stop the redirector for all users.")
	}

	return nil
}

func (v *CmdConfigureRedirector) GetUsage() libkb.Usage {
	return libkb.Usage{
		Config:    true,
		API:       true,
		AllowRoot: true,
	}
}
