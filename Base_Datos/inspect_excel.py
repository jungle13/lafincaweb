import pandas as pd
import json

file_path = "SIMULACIÓN CONTEO BODEGA.xlsx"
try:
    xl = pd.ExcelFile(file_path)
    output = {"sheets": {}}
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        # Convert all columns to string so it's easier to preview
        output["sheets"][sheet_name] = {
            "columns": df.columns.tolist(),
            "sample": df.head(5).astype(str).to_dict(orient="records")
        }
    print(json.dumps(output, indent=2))
except Exception as e:
    print(f"Error: {e}")
