# Collect playback diagnostics from an Android TV connected through ADB.
# Usage: .\tools\l1-collect-android-diagnostics.ps1 -Serial 192.168.1.50:5555
param(
    [string]$Serial,
    [string]$OutputDirectory = "l1-android-diagnostics"
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
    throw "ADB not found. Install Android SDK Platform Tools and add adb to PATH."
}

$adbArgs = @()
if ($Serial) { $adbArgs = @("-s", $Serial) }

# Windows PowerShell 5.1 turns native stderr into error records when
# ErrorActionPreference=Stop. Start ADB first and use a non-terminating policy
# for native commands; always validate the native process exit code.
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $null = & adb start-server 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Could not start the ADB server." }

    if ($Serial -and $Serial -match '^[^:]+:[0-9]+

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$folder = Join-Path $OutputDirectory $stamp
New-Item -ItemType Directory -Path $folder -Force | Out-Null

$properties = @(
    "ro.product.model",
    "ro.product.manufacturer",
    "ro.build.version.release",
    "ro.build.version.sdk",
    "ro.product.cpu.abi",
    "ro.product.cpu.abilist",
    "ro.product.cpu.abilist32",
    "ro.product.cpu.abilist64"
)
$lines = foreach ($property in $properties) {
    $value = (& adb @adbArgs shell getprop $property 2>&1) -join " "
    "$property=$($value.Trim())"
}
$lines | Set-Content -Path (Join-Path $folder "device-properties.txt") -Encoding UTF8

# ADB output is diagnostic evidence, not a guarantee of stream or passthrough support.
$oldPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    & adb @adbArgs shell dumpsys -l 2>&1 |
        Out-File (Join-Path $folder "services.txt")

    & adb @adbArgs shell dumpsys media.codec 2>&1 |
        Out-File (Join-Path $folder "media-codec.txt")

    & adb @adbArgs shell dumpsys media.metrics 2>&1 |
        Out-File (Join-Path $folder "media-metrics.txt")

    & adb @adbArgs shell dumpsys audio 2>&1 |
        Out-File (Join-Path $folder "audio.txt")

    & adb @adbArgs shell dumpsys display 2>&1 |
        Out-File (Join-Path $folder "display.txt")
}
finally {
    $ErrorActionPreference = $oldPreference
}

# Clear only the log buffer so the next playback session is easier to inspect.
& adb @adbArgs logcat -c
Write-Host "Logs cleared. Start playback of a 4K/HDR video on the TV, then press Enter."
[void](Read-Host "Press Enter after reproducing the issue")
& adb @adbArgs logcat -d -v threadtime > (Join-Path $folder "logcat-full.txt") 2>&1
Get-Content (Join-Path $folder "logcat-full.txt") |
    Select-String -Pattern "L1 codec capability|L1 video support|L1 video profile|L1 audio decode support|L1 .*unavailable|MediaCodec|ExoPlayer" |
    Set-Content -Path (Join-Path $folder "logcat-media.txt") -Encoding UTF8

Write-Host "Diagnostics saved to: $folder"
Write-Host "Review logs for account identifiers or other sensitive information before sharing."
) {
        $connectResult = (& adb connect $Serial 2>&1) -join " "
        if ($LASTEXITCODE -ne 0) {
            throw "ADB connection failed: $connectResult"
        }
    }

    $deviceState = & adb @adbArgs get-state 2>&1
    $stateExitCode = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $previousErrorActionPreference
}
if ($stateExitCode -ne 0 -or ($deviceState -join "").Trim() -ne "device") {
    throw "ADB device unavailable. Run adb devices and authorize debugging on the TV."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$folder = Join-Path $OutputDirectory $stamp
New-Item -ItemType Directory -Path $folder -Force | Out-Null

$properties = @(
    "ro.product.model",
    "ro.product.manufacturer",
    "ro.build.version.release",
    "ro.build.version.sdk",
    "ro.product.cpu.abi",
    "ro.product.cpu.abilist",
    "ro.product.cpu.abilist32",
    "ro.product.cpu.abilist64"
)
$lines = foreach ($property in $properties) {
    $value = (& adb @adbArgs shell getprop $property 2>&1) -join " "
    "$property=$($value.Trim())"
}
$lines | Set-Content -Path (Join-Path $folder "device-properties.txt") -Encoding UTF8

# ADB output is diagnostic evidence, not a guarantee of stream or passthrough support.
& adb @adbArgs shell dumpsys media.codec > (Join-Path $folder "media-codec.txt") 2>&1
& adb @adbArgs shell dumpsys audio > (Join-Path $folder "audio.txt") 2>&1
& adb @adbArgs shell dumpsys display > (Join-Path $folder "display.txt") 2>&1

# Clear only the log buffer so the next playback session is easier to inspect.
& adb @adbArgs logcat -c
Write-Host "Logs cleared. Start playback of a 4K/HDR video on the TV, then press Enter."
[void](Read-Host "Press Enter after reproducing the issue")
& adb @adbArgs logcat -d -v threadtime > (Join-Path $folder "logcat-full.txt") 2>&1
Get-Content (Join-Path $folder "logcat-full.txt") |
    Select-String -Pattern "L1 codec capability|L1 video support|L1 video profile|L1 audio decode support|L1 .*unavailable|MediaCodec|ExoPlayer" |
    Set-Content -Path (Join-Path $folder "logcat-media.txt") -Encoding UTF8

Write-Host "Diagnostics saved to: $folder"
Write-Host "Review logs for account identifiers or other sensitive information before sharing."
