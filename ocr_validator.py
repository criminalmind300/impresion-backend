import sys, json, re, argparse
from datetime import datetime
import cv2
import pytesseract
from PIL import Image, ExifTags

parser = argparse.ArgumentParser()
parser.add_argument('--image', required=True)
args = parser.parse_args()

SOFTWARE_EDITORES = ['photoshop', 'canva', 'picsart', 'gimp', 'lightroom', 'illustrator']

imagen_editada = False
software_detectado = None
try:
    img_pil = Image.open(args.image)
    exif = img_pil._getexif() or {}
    for tag_id, value in exif.items():
        tag = ExifTags.TAGS.get(tag_id, tag_id)
        if tag == 'Software':
            val_str = str(value).lower()
            for sw in SOFTWARE_EDITORES:
                if sw in val_str:
                    imagen_editada = True
                    software_detectado = value
                    break
except Exception:
    pass

img = cv2.imread(args.image)
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
text = pytesseract.image_to_string(gray)

match_monto = re.search(r'(\$|\bUSD\b|\bRD\$\b)?\s*(\d+[\.,]\d{2})', text)
monto = float(match_monto.group(2).replace(',', '.')) if match_monto else 0.0

match_ref = re.search(r'(ref|referencia|comprobante|transaccion|no\.)\s*:?\s*(\d{6,12})', text, re.IGNORECASE)
referencia = match_ref.group(2) if match_ref else None

fecha_hoy_1 = datetime.now().strftime("%d/%m/%Y")
fecha_hoy_2 = datetime.now().strftime("%d-%m-%Y")
es_fecha_hoy = (fecha_hoy_1 in text) or (fecha_hoy_2 in text)

resultado = {
    "monto_detectado": monto,
    "referencia": referencia,
    "es_fecha_valida": es_fecha_hoy,
    "imagen_editada": imagen_editada,
    "software_detectado": software_detectado
}

print(json.dumps(resultado))