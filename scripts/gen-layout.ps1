# Generate Navbar
$f = "C:\wse\OnboardAI\src\components\layout\navbar.tsx"
Remove-Item $f -Force -ErrorAction SilentlyContinue

Add-Content $f -Value '"use client";'
Add-Content $f -Value 'import { Menu, Bell, User } from "lucide-react";'
Add-Content $f -Value ''

Add-Content $f -Value 'export function Navbar({ onMenuClick, user }: {