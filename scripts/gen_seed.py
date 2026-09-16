"""
supabase/seed.sql үүсгэнэ: src/lib/camps-mn.json-ийн 73 зуслан.
zuca.mn дээрх 15 нь seed-zuca.sql-тэй zuca_slug-аар нийлнэ (нөхөх ажлууд тэнд).

Ажиллуулах: python3 scripts/gen_seed.py > supabase/seed.sql
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
camps = json.loads((ROOT / "src/lib/camps-mn.json").read_text())

COLS = ["name", "stage", "season", "aimag", "soum", "address", "contact_person", "phone", "website", "facebook",
        "age_min", "age_max", "capacity", "price_from", "description", "photos_count", "ownership", "register_no",
        "founded_year", "distance_km", "notes"]


OLD_DEMO = ["Хөх тэнгэр хүүхдийн зуслан", "Нарлаг хөндий", "Оюуны гэрэл STEM зуслан", "Хүрэлтогоот адал явдал",
            "Бэлчээр эко зуслан", "Туул голын эрэг", "Алтан нуга", "Хангайн өндөрлөг", "Хөвсгөл далай зуслан",
            "Дархан залуу судлаач", "Орхон хөндийн зуслан", "Говийн од", "Бургастай", "Эрдэнэт хүүхдийн ордон зуслан",
            "Хэрлэн мөрөн", "Цагаан сар зуслан", "Ховдын оргил", "Хар ус", "Шинэ үе спорт зуслан",
            "Сэлбэ урлагийн зуслан", "Бөхөг уул", "Сүүн далай", "Их Монгол адал явдал", "Жаргалантын нарс"]
OLD_TASKS = []  # хуучин жишээ ажлуудыг гараар устгана (README)


def q(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def row(c, i, cols):
    return "  (" + ", ".join(
        q(c.get(k) if not (k == "photos_count" and c.get(k) is None) else 0)
        + ("::camp_stage" if k == "stage" else "::camp_season" if k == "season" else "")
        for k in cols) + f", {(i + 1) * 1000})"


zuca = [(i, c) for i, c in enumerate(camps) if c.get("zuca_slug")]
other = [(i, c) for i, c in enumerate(camps) if not c.get("zuca_slug")]
ZCOLS = COLS + ["zuca_slug"]
TYPES = {"stage": "camp_stage", "season": "camp_season", "age_min": "int", "age_max": "int", "capacity": "int",
         "price_from": "int", "photos_count": "int", "founded_year": "int", "distance_km": "double precision"}

out = [
    "-- ZUCA Ops — МҮЗХ-ны бодит зуслангийн жагсаалт (73 зуслан).",
    "-- Эх сурвалж: МҮЗХ «Хүүхдийн зуслангуудын дэлгэрэнгүй мэдээллийн жагсаалт» (2026.05.28) + zuca.mn (2026.09.16).",
    "-- schema.sql → seed-zuca.sql → энэ файл гэсэн дарааллаар ажиллуулна. Дахин ажиллуулахад давхардахгүй.",
    "-- Үүсгэсэн: python3 scripts/gen_seed.py > supabase/seed.sql",
    "",
    "-- 0. Өмнөх хувилбарын зохиомол жишээ зуслангуудыг (хэрэв оруулсан бол) цэвэрлэнэ",
    "delete from public.camps where name in (" + ", ".join(q(n) for n in OLD_DEMO) + ")",
    "  and register_no is null and ownership is null and zuca_slug is null;",
    "",
    "-- 1. zuca.mn дээрх 15 зуслан: seed-zuca.sql-ээр орсон бол МҮЗХ-ны талбаруудыг л нэмнэ",
    "insert into public.camps (" + ", ".join(ZCOLS) + ", position) values",
    ",\n".join(row(c, i, ZCOLS) for i, c in zuca),
    "on conflict (zuca_slug) do update set",
    "  ownership      = excluded.ownership,",
    "  register_no    = excluded.register_no,",
    "  founded_year   = coalesce(public.camps.founded_year, excluded.founded_year),",
    "  distance_km    = coalesce(public.camps.distance_km, excluded.distance_km),",
    "  capacity       = coalesce(public.camps.capacity, excluded.capacity),",
    "  contact_person = coalesce(public.camps.contact_person, excluded.contact_person),",
    "  soum           = coalesce(public.camps.soum, excluded.soum);",
    "",
    "-- 2. Бусад 58 зуслан (ижил нэртэй байвал алгасна)",
    "insert into public.camps (" + ", ".join(COLS) + ", position)",
    "select " + ", ".join(f"v.{k}::{TYPES.get(k, 'text')}" for k in COLS) + ", v.position from (values",
    ",\n".join(row(c, i, COLS) for i, c in other),
    ") as v(" + ", ".join(COLS) + ", position)",
    "where not exists (select 1 from public.camps c where c.name = v.name);",
]
print("\n".join(out))
