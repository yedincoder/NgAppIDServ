package main

import (
"embed"
"github.com/wailsapp/wails/v2"
"github.com/wailsapp/wails/v2/pkg/options"
"github.com/wailsapp/wails/v2/pkg/options/assetserver"
"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed all:frontend
var assets embed.FS

func main() {
app := NewApp()

err := wails.Run(&options.App{
Title:         "NgAppIDServ - Webserver Local Modern",
Width:         750,
Height:        530,
DisableResize: true,
AssetServer: &assetserver.Options{
Assets: assets,
},
OnStartup:  app.startup,
OnShutdown: app.shutdown,
Bind: []interface{}{
app,
},
Windows: &windows.Options{
WebviewIsTransparent: false,
WindowIsTranslucent:  false,
DisableWindowIcon:    false,
},
})

if err != nil {
println("Error:", err.Error())
}
}
