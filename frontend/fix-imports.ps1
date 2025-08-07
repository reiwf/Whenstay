Get-ChildItem -Recurse -Include *.jsx,*.js | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $content = $content -replace 'from "\.\.\/react"', 'from "react"'
    $content = $content -replace 'from "\.\.\/react-router-dom"', 'from "react-router-dom"'
    $content = $content -replace 'from "\.\.\/react-hot-toast"', 'from "react-hot-toast"'
    $content = $content -replace 'from "\.\.\/react-hook-form"', 'from "react-hook-form"'
    $content = $content -replace 'from "\.\.\/lucide-react"', 'from "lucide-react"'
    $content = $content -replace 'from "\.\.\/\.\.\/\.\.\/react"', 'from "react"'
    $content = $content -replace 'from "\.\.\/\.\.\/\.\.\/react-router-dom"', 'from "react-router-dom"'
    $content = $content -replace 'from "\.\.\/\.\.\/\.\.\/react-hot-toast"', 'from "react-hot-toast"'
    $content = $content -replace 'from "\.\.\/\.\.\/\.\.\/react-hook-form"', 'from "react-hook-form"'
    $content = $content -replace 'from "\.\.\/\.\.\/\.\.\/lucide-react"', 'from "lucide-react"'
    Set-Content $_.FullName $content
}
