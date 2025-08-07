# Fix all import paths in React files - comprehensive version
Get-ChildItem -Recurse -Path "src" -Include *.jsx,*.js | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content) {
        $originalContent = $content
        
        # Fix React imports - all variations
        $content = $content -replace 'from\s+"\.\.\/react"', 'from "react"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/react"', 'from "react"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/\.\.\/react"', 'from "react"'
        $content = $content -replace "from\s+'\.\.\/react'", "from 'react'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/react'", "from 'react'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/\.\.\/react'", "from 'react'"
        
        # Fix React Router imports
        $content = $content -replace 'from\s+"\.\.\/react-router-dom"', 'from "react-router-dom"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/react-router-dom"', 'from "react-router-dom"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/\.\.\/react-router-dom"', 'from "react-router-dom"'
        $content = $content -replace "from\s+'\.\.\/react-router-dom'", "from 'react-router-dom'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/react-router-dom'", "from 'react-router-dom'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/\.\.\/react-router-dom'", "from 'react-router-dom'"
        
        # Fix React Hot Toast imports
        $content = $content -replace 'from\s+"\.\.\/react-hot-toast"', 'from "react-hot-toast"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/react-hot-toast"', 'from "react-hot-toast"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/\.\.\/react-hot-toast"', 'from "react-hot-toast"'
        $content = $content -replace "from\s+'\.\.\/react-hot-toast'", "from 'react-hot-toast'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/react-hot-toast'", "from 'react-hot-toast'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/\.\.\/react-hot-toast'", "from 'react-hot-toast'"
        
        # Fix React Hook Form imports
        $content = $content -replace 'from\s+"\.\.\/react-hook-form"', 'from "react-hook-form"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/react-hook-form"', 'from "react-hook-form"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/\.\.\/react-hook-form"', 'from "react-hook-form"'
        $content = $content -replace "from\s+'\.\.\/react-hook-form'", "from 'react-hook-form'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/react-hook-form'", "from 'react-hook-form'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/\.\.\/react-hook-form'", "from 'react-hook-form'"
        
        # Fix Lucide React imports
        $content = $content -replace 'from\s+"\.\.\/lucide-react"', 'from "lucide-react"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/lucide-react"', 'from "lucide-react"'
        $content = $content -replace 'from\s+"\.\.\/\.\.\/\.\.\/lucide-react"', 'from "lucide-react"'
        $content = $content -replace "from\s+'\.\.\/lucide-react'", "from 'lucide-react'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/lucide-react'", "from 'lucide-react'"
        $content = $content -replace "from\s+'\.\.\/\.\.\/\.\.\/lucide-react'", "from 'lucide-react'"
        
        # Fix default imports too
        $content = $content -replace 'import\s+toast\s+from\s+"\.\.\/react-hot-toast"', 'import toast from "react-hot-toast"'
        $content = $content -replace 'import\s+toast\s+from\s+"\.\.\/\.\.\/react-hot-toast"', 'import toast from "react-hot-toast"'
        $content = $content -replace 'import\s+toast\s+from\s+"\.\.\/\.\.\/\.\.\/react-hot-toast"', 'import toast from "react-hot-toast"'
        $content = $content -replace "import\s+toast\s+from\s+'\.\.\/react-hot-toast'", "import toast from 'react-hot-toast'"
        $content = $content -replace "import\s+toast\s+from\s+'\.\.\/\.\.\/react-hot-toast'", "import toast from 'react-hot-toast'"
        $content = $content -replace "import\s+toast\s+from\s+'\.\.\/\.\.\/\.\.\/react-hot-toast'", "import toast from 'react-hot-toast'"
        
        # Only write if content changed
        if ($content -ne $originalContent) {
            Set-Content $_.FullName $content
            Write-Host "Fixed imports in: $($_.FullName)"
        }
    }
}
