"""
МҮЗХ-ны "Хүүхдийн зуслангуудын дэлгэрэнгүй мэдээллийн жагсаалт" (2026.05.28, "Нэгдсэн мэдээлэл" хуудас)
+ zuca.mn дээрх 15 зуслангийн мэдээллийг нэгтгэж src/lib/camps-mn.json үүсгэнэ.

Ажиллуулах: python3 scripts/import_mn_camps.py "<xlsx зам>"
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

XLSX = sys.argv[1]
OUT = Path(__file__).resolve().parent.parent / "src/lib/camps-mn.json"

# ── zuca.mn (2026-09-16-ны байдлаар /camps хуудсанд 15 зуслан) ──
# key = Excel дэх мөрийн № ; утасны дугаар, FB, нас, үнэ, зургийн тоо zuca.mn профайлаас
ZUCA = {
    55: dict(name="Сансар олон улсын хүүхдийн зуслан", slug="sansar-international-camp", phone="89038886, 89941805",
             facebook="facebook.com/profile.php?id=100067098795882", age=(6, 18), capacity=650, price=None, photos=1,
             address="Баянзүрх дүүрэг, Гачууртын «Шар хоолойн ам», УБ-аас 38 км"),
    49: dict(name="English Camp", slug="english-camp", phone="99097476, 80248064",
             facebook="facebook.com/profile.php?id=100063605438570", age=(6, 18), price=595000, photos=10),
    57: dict(name="Нарлаг", slug="narlag-camp", phone="99104039, 86074039", facebook="facebook.com/share/1B1baTeoDY",
             age=(6, 18), capacity=240, price=85000, photos=7,
             address="Тэрэлж, Горхийн ам, Мэлхий хадны орчим, УБ-аас 65 км", founded=1985),
    18: dict(name="Урандөш хүүхдийн зуслан (Хөвсгөл)", slug="urandosh-camp", phone="99223787, 99382215",
             facebook="facebook.com/profile.php?id=61574198632756", age=(6, 18), price=None, photos=6,
             address="Бүрэнтогтох сум, Мөрөн голын хөвөө «Их чигж», Мөрөн хотоос 18 км"),
    54: dict(name="Галакси хүүхдийн зуслан", slug="galaxy-camp", phone="99026644", facebook="facebook.com/GALAXYZUSLAN",
             age=(6, 18), capacity=525, price=85000, photos=3, founded=2008),
    58: dict(name="Жавхлант зуслан", slug="javkhlant-camp", phone="95903070, 83040429", facebook="facebook.com/javkhlantcamp",
             age=(6, 18), capacity=250, price=None, photos=1, address="Тэрэлж, Мэлхий хадны ойролцоо"),
    40: dict(name="Цагаан нуга", slug="tsagaan-nuga-camp", phone="99030511, 99688688", facebook="facebook.com/tsagaannuga",
             age=(6, 18), capacity=240, price=None, photos=1),
    46: dict(name="Номт хүүхдийн зуслан", slug="nomt-camp", phone="94025909, 85008989", facebook="facebook.com/Educare.Camp",
             age=(6, 18), price=85000, photos=8),
    68: dict(name="Би Монгол Хүн хүүхдийн хүрээ", slug="augaa-mongol-camp", phone="94221155, 91119923",
             facebook="facebook.com/BiMongolKhuncamp", age=(6, 18), capacity=65, price=None, photos=14,
             address="Горхи-Тэрэлж", season="all_year"),
    41: dict(name="Мөрөөдөл олон улсын хүүхдийн зуслан", slug="moroodol-camp", phone="95191144, 77711144",
             facebook="facebook.com/Dreamcamp.mn", age=(6, 18), price=100000, photos=5, founded=2013),
    72: dict(name="Дайманд хүүхдийн зуслан", slug="diamond-zuslan", phone="88107245, 80123822",
             facebook="facebook.com/DiamondMind.Education", age=(7, 15), price=None, photos=2),
    12: dict(name="Зулзагын гол зуслан", slug="zulzagiin-gol-camp", phone="80016066", age=(6, 18), price=None, photos=1),
    73: dict(name="Joyful Family Camp", slug="joyful-family-camp", phone="94006296, 88776296",
             facebook="facebook.com/profile.php?id=61589724478496", age=(6, 18), price=None, photos=9),
    56: dict(name="Нарс хүүхдийн зуслан (Pine camp)", slug="nars-camp", phone="99096109, 11325329",
             facebook="facebook.com/narssummercamp", age=(6, 18), price=540000, photos=6),
    2: dict(name="Шонхор хүүхдийн зуслан", slug="shonhor-camp", phone="99039042, 94228885",
            facebook="facebook.com/profile.php?id=61584089294116", age=(6, 18), price=None, photos=1, no_desc=True),
}

# Тайлбараас харахад одоогоор ажиллахгүй байгаа
INACTIVE = {
    20: "Барилга нураасан, суурь л байгаа",
    45: "Газар, үл хөдлөх нь зарагдсан",
    51: "2017 оноос хойш үйл ажиллагаа явуулаагүй",
    53: "3 жил ажиллаагүй",
    65: "Сүүлийн 2 жил ажиллаагүй",
}

UB_DISTRICTS = {
    "схд": "Сонгинохайрхан", "сбд": "Сүхбаатар", "бзд": "Баянзүрх", "худ": "Хан-Уул",
    "сүхбаатар дүүрэг": "Сүхбаатар", "баянзүрх дүүрэг": "Баянзүрх", "хан-уул дүүрэг": "Хан-Уул",
    "налайх дүүрэг": "Налайх", "багануур дүүрэг": "Багануур",
}

AIMAG_FIX = {
    "хөсгөл": "Хөвсгөл", "өмнө говь": "Өмнөговь", "дархан -уул аймаг": "Дархан-Уул",
    "төв айма": "Төв", "говь-алтай": "Говь-Алтай", "баян-өлгий": "Баян-Өлгий",
}

AIMAGS = ["Архангай", "Баян-Өлгий", "Баянхонгор", "Булган", "Говь-Алтай", "Говьсүмбэр", "Дархан-Уул", "Дорноговь",
          "Дорнод", "Дундговь", "Завхан", "Орхон", "Өвөрхангай", "Өмнөговь", "Сүхбаатар", "Сэлэнгэ", "Төв", "Увс",
          "Ховд", "Хөвсгөл", "Хэнтий"]


def s(v):
    if v is None:
        return None
    t = re.sub(r"\s+", " ", str(v)).strip().strip('"“”')
    return t or None


def norm_aimag(raw, soum):
    """(aimag, soum) буцаана. УБ-ын дүүргийг soum болгоно."""
    a = (s(raw) or "").lower()
    so = s(soum)
    if a in UB_DISTRICTS:
        return "Улаанбаатар", UB_DISTRICTS[a] + " дүүрэг"
    if a.startswith("улаанбаатар"):
        return "Улаанбаатар", so
    if a in AIMAG_FIX:
        return AIMAG_FIX[a], so
    if a.startswith("зүүн хараа"):
        return "Сэлэнгэ", "Зүүнхараа"
    for name in AIMAGS:
        if a.startswith(name.lower()):
            return name, so
    if not a:
        low = (so or "").lower()
        if "хороо" in low:
            return "Улаанбаатар", so
        if "налайх" in low:
            return "Улаанбаатар", "Налайх дүүрэг"
        if "эрдэнэ сум" in low or "аргалант" in low:
            return "Төв", so
    return (s(raw).title() if s(raw) else None), so


SOUM_FIX = {"СХД": "Сонгинохайрхан дүүрэг", "СБД": "Сүхбаатар дүүрэг", "Бамсүмбэр сум": "Батсүмбэр сум",
            "мөнгөн мориь сум": "Мөнгөнморьт сум", "19р хороо": "Сүхбаатар дүүрэг"}


def clean_soum(v):
    v = s(v)
    if not v:
        return None
    v = SOUM_FIX.get(v, v)
    v = re.sub(r"\bсум\b", "сум", v, flags=re.I)
    return v[0].upper() + v[1:]


PHONE_RE = re.compile(r"(\d{4})[\s-]?(\d{4})")


def phones(v):
    if v is None:
        return []
    return ["".join(m) for m in PHONE_RE.findall(str(v))]


def contact_name(v):
    t = s(v)
    if not t:
        return None
    t = re.sub(r"[\d/+\-–]+", " ", t)
    t = re.sub(r"\b(Захирал|ЗДТГ дарга)\b", r"\1", t)
    t = re.sub(r"\s+", " ", t).strip(" ,.")
    return t if re.search(r"[А-Яа-яӨөҮүЁё]{2,}", t) else None


def first_int(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    t = str(v)
    m = re.search(r"зун-?\s*(\d+)", t)  # "өвөл-280 зун-300"
    if m:
        return int(m.group(1))
    m = re.search(r"\d+", t)
    return int(m.group()) if m else None


def year(v):
    if v is None:
        return None
    if hasattr(v, "year"):
        return v.year
    m = re.search(r"(19|20)\d{2}", str(v))
    return int(m.group()) if m else None


def ownership(v, name):
    t = (s(v) or "").lower()
    n = (name or "").lower()
    if "хөдөлмөр" in t or "хөдөлмөр" in n or "гэр зуслан" in t or "сургуулийн дэргэд" in t:
        return "labor"
    if "байгууллагын" in t:
        return "org"
    if "улсын" in t or "төрийн" in t or "төөүг" in t or "төүг" in t:
        return "state"
    if "орон нутг" in t or "орн нутг" in t or "онөүг" in t:
        return "local"
    if "хувийн" in t:
        return "private"
    return None


def distance(v):
    t = s(v)
    if not t:
        return None
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(км|м)?", t)
    if not m:
        return None
    km = float(m.group(1).replace(",", "."))
    if m.group(2) == "м" and "км" not in t:
        km /= 1000
    return km


wb = openpyxl.load_workbook(XLSX, data_only=True)
ws = wb["Нэгдсэн мэдээлэл"]

camps = []
for r in ws.iter_rows(min_row=4, values_only=True):
    no, name = r[0], s(r[1])
    if not name:
        continue
    if not isinstance(no, int):
        # Сүүлийн мөр: "... Нийт тоо" гэж бичигдсэн 73 дахь мөр
        m = re.search(r"\d+", str(no))
        no = int(m.group()) if m else len(camps) + 1

    aimag, soum = norm_aimag(r[3], r[4])
    bag, addr, settlement, dist = s(r[5]), s(r[6]), s(r[8]), s(r[9])
    # Зарим мөрөнд "Сум" баганад газрын нэр бичигдсэн
    if soum and re.search(r"\d+\s*км|тэрэлж|ам$|ам ", soum, re.I) and "дүүрэг" not in soum:
        addr = ", ".join(x for x in [soum, addr] if x)
        soum = None if aimag != "Улаанбаатар" else soum
    address_parts = [x for x in [bag, addr] if x]
    if settlement and dist:
        address_parts.append(f"{settlement}-аас {dist}")
    elif dist:
        address_parts.append(dist)

    ph = phones(r[7]) + [p for p in phones(r[8]) if p not in phones(r[7])]
    notes = []
    if s(r[17]):
        notes.append(f"МҮЗХ тайлбар: {s(r[17])}")
    if no in INACTIVE:
        notes.insert(0, f"Идэвхгүй: {INACTIVE[no]}")

    if no == 72:
        address_parts = []
    c = {
        "src_no": no,
        "name": name.rstrip(" ,"),
        "stage": "inactive" if no in INACTIVE else "lead",
        "season": "summer",
        "aimag": aimag,
        "soum": clean_soum(soum),
        "address": ", ".join(address_parts) or None,
        "contact_person": contact_name(r[7]),
        "phone": ", ".join(dict.fromkeys(ph)) or None,
        "capacity": first_int(r[12]),
        "ownership": ownership(r[11], name),
        "register_no": str(r[2]) if r[2] else None,
        "founded_year": year(r[10]),
        "distance_km": distance(r[9]),
        "notes": "\n".join(notes) or None,
        "on_zuca": False,
    }

    z = ZUCA.get(no)
    if z:
        c.update(
            name=z["name"],
            stage="active",
            on_zuca=True,
            zuca_slug=z["slug"],
            website=f"https://zuca.mn/camps/{z['slug']}",
            phone=", ".join(dict.fromkeys([p.strip() for p in z["phone"].split(",")] + ph)),
            facebook=("https://www." + z["facebook"]) if z.get("facebook") else None,
            age_min=z["age"][0],
            age_max=z["age"][1],
            price_from=z.get("price"),
            photos_count=z.get("photos", 0),
            season=z.get("season", "summer"),
            description=None if z.get("no_desc") else
            f"zuca.mn профайл дээр танилцуулга байгаа: https://zuca.mn/camps/{z['slug']}",
        )
        if z.get("capacity") and not c["capacity"]:
            c["capacity"] = z["capacity"]
        if z.get("address"):
            c["address"] = z["address"]
        if z.get("founded") and not c["founded_year"]:
            c["founded_year"] = z["founded"]
        if not c["notes"]:
            c["notes"] = None
        c["notes"] = "\n".join(x for x in [f"МҮЗХ жагсаалтад: «{name}»" if name != z["name"] else None, c["notes"]] if x) or None
    camps.append(c)

assert len(camps) == 73, len(camps)
assert sum(c["on_zuca"] for c in camps) == 15
OUT.write_text(json.dumps(camps, ensure_ascii=False, indent=1))
print(f"{len(camps)} зуслан → {OUT}")
