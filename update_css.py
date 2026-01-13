
import re

file_path = "templates/body_tracking.html"

new_css = """        .l-cuello {
            top: 10%;
            left: 50%;
            transform: translateX(-50%);
        }

        .l-torax {
            top: 22%;
            left: 65%;
        }

        .l-biceps-izq {
            top: 28%;
            right: 74%;
            text-align: right;
        }

        .l-ant-izq {
            top: 36%;
            right: 76%;
            text-align: right;
        }

        .l-cintura {
            top: 38%;
            left: 65%;
        }

        .l-cadera {
            top: 48%;
            right: 72%;
            text-align: right;
        }

        .l-muslo-izq {
            top: 60%;
            right: 68%;
            text-align: right;
        }

        .l-pant-izq {
            top: 78%;
            right: 68%;
            text-align: right;
        }"""

try:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regex to capture from .l-cuello to the closing brace of .l-pant-izq
    # We assume standard structure.
    # Pattern: .l-cuello \{.*?\.l-pant-izq \{.*?\}
    pattern = re.compile(r"^\s*\.l-cuello\s*\{.*^\s*\.l-pant-izq\s*\{.*?^\s*\}", re.DOTALL | re.MULTILINE)
    
    match = pattern.search(content)
    if match:
        print("Found match!")
        new_content = content[:match.start()] + new_css + content[match.end():]
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Successfully updated CSS.")
    else:
        print("Could not find the CSS block to replace.")
        # Debug: check first few lines of where we expect it
        idx = content.find(".l-cuello")
        if idx != -1:
            print(f"Found .l-cuello at index {idx}. Context:\n{content[idx:idx+100]}")
        else:
            print(".l-cuello not found.")

except Exception as e:
    print(f"Error: {e}")
