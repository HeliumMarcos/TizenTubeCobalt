import os
import zipfile
import subprocess

BASE_DIR = r"C:\Users\HeliumMarcos\.gemini\antigravity\scratch"
INPUT_APK = os.path.join(BASE_DIR, "reisxd-cobalt-arm-v2.0.3.apk")
PREV_L1_APK = os.path.join(BASE_DIR, "TizenTube-L1-armeabi-v7a.apk")
UNALIGNED_APK = os.path.join(BASE_DIR, "temp_unaligned_qa.apk")
FINAL_APK = os.path.join(BASE_DIR, "TizenTube-L1-qa-armeabi-v7a.apk")

ZIPALIGN = r"C:\Users\HeliumMarcos\Documents\Codex\2026-11-07\ana-2\work\android-tools\sdk\build-tools\34.0.0\zipalign.exe"
APKSIGNER = r"C:\Users\HeliumMarcos\Documents\Codex\2026-11-07\ana-2\work\android-tools\sdk\build-tools\34.0.0\apksigner.bat"
KEYSTORE = r"C:\Users\HeliumMarcos\.android\debug.keystore"

print(f"Reading official QA base APK: {INPUT_APK}")
with zipfile.ZipFile(INPUT_APK, 'r') as zin:
    entries = {}
    compress_types = {}
    for item in zin.infolist():
        entries[item.filename] = zin.read(item.filename)
        compress_types[item.filename] = item.compress_type

# Copy verified standalone AndroidManifest.xml (identical xmltree, package=io.gh.heliummarcos.tizentube.cobalt, label=TizenTube L1)
with zipfile.ZipFile(PREV_L1_APK, 'r') as zprev:
    entries['AndroidManifest.xml'] = zprev.read('AndroidManifest.xml')

so_data = bytearray(entries['lib/armeabi-v7a/libchrobalt.so'])

url1_orig = b'https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js?v='
url1_new  = b'https://cdn.jsdelivr.net/gh/HeliumMarcos/TizenTubeCobalt@main/u.js?v='
assert len(url1_orig) == len(url1_new) == 69

url2_orig = b'https://cdn.jsdelivr.net/npm/@foxreis/tizentube/dist/userScript.js'
url2_new  = b'https://cdn.jsdelivr.net/gh/HeliumMarcos/TizenTubeCobalt@main/u.js'
assert len(url2_orig) == len(url2_new) == 66

c1 = so_data.count(url1_orig)
c2 = so_data.count(url2_orig)
print(f"URL occurrences: url1={c1}, url2={c2}")
assert c1 == 1 and c2 == 2

so_data = so_data.replace(url1_orig, url1_new)
so_data = so_data.replace(url2_orig, url2_new)
entries['lib/armeabi-v7a/libchrobalt.so'] = bytes(so_data)

for k in list(entries.keys()):
    if k.startswith('META-INF/'):
        del entries[k]

print(f"Writing unaligned APK: {UNALIGNED_APK}")
with zipfile.ZipFile(UNALIGNED_APK, 'w') as zout:
    for filename, content in entries.items():
        if filename == 'resources.arsc' or filename.endswith('.so'):
            zout.writestr(filename, content, compress_type=zipfile.ZIP_STORED)
        else:
            zout.writestr(filename, content, compress_type=compress_types.get(filename, zipfile.ZIP_DEFLATED))

if os.path.exists(FINAL_APK):
    os.remove(FINAL_APK)

print("Running zipalign...")
subprocess.run([ZIPALIGN, "-p", "-f", "4", UNALIGNED_APK, FINAL_APK], check=True)

print("Running apksigner...")
subprocess.run([
    APKSIGNER, "sign",
    "--ks", KEYSTORE,
    "--ks-pass", "pass:android",
    "--key-pass", "pass:android",
    "--ks-key-alias", "androiddebugkey",
    FINAL_APK
], check=True)

subprocess.run([APKSIGNER, "verify", FINAL_APK], check=True)
print("SUCCESS:", FINAL_APK, os.path.getsize(FINAL_APK))
