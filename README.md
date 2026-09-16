# ZUCA Ops

ZUCA багийн дотоод удирдлагын вэб: ажил (task), зуслангийн жагсаалт, тайлан.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime) · dnd-kit

## Юу хийдэг вэ

| Хуудас | Боломж |
|---|---|
| **Самбар** `/` | Миний ажил, яаралтай, хугацаа хэтэрсэн, мэдээлэл дутуу зуслангийн тоо. Анхаарах ажлууд, хамгийн дутуу мэдээлэлтэй зуслангууд, 7 хоногийн график |
| **Ажлууд** `/tasks` | Kanban самбар, чирж зөөнө. **Төлөвөөр** (Хийх → Хийж байна → Шалгах → Дууссан) эсвэл **Яаралтай байдлаар** (Яаралтай / Өндөр / Дунд / Бага) харна. Хүн, яаралтай байдал, хугацаа хэтэрснээр шүүнэ. `N` товч = шинэ ажил |
| **Зуслангууд** `/camps` | Монголын бүх зуслан. **Pipeline** (Холбогдоогүй → Холбогдсон → Бүртгэж байна → Идэвхтэй → Идэвхгүй) чирж зөөнө, эсвэл **Хүснэгт**. Зуслан бүрт мэдээллийн бүрэн байдлын % ба дутуу талбарууд. "Нөхөх ажил үүсгэх" товч. CSV импорт/экспорт |
| **Тайлан** `/reports` | 7/30/90 хоног: дууссан/шинэ ажил, гүйцэтгэх хугацаа, хугацаандаа дууссан %, гишүүн тус бүр, pipeline, дутуу мэдээлэл, аймгаар. CSV, хэвлэх |

Бүрэн байдлыг `src/lib/completeness.ts`-д тохируулна (утас, хүн, имэйл, аймаг, хаяг, координат, нас, багтаамж, үнэ, тайлбар, 3+ зураг, гэрээ).

## Эхлүүлэх

```bash
cd ~/Desktop/zuca-ops
npm install
npm run dev
```
→ http://localhost:3000

`.env.local` хоосон бол апп **Demo горим**-оор ажиллана (өгөгдөл browser-т хадгалагдана). Supabase-г холбохдоо:

### Supabase тохиргоо (нэг удаа)

1. **SQL Editor** → `supabase/schema.sql`-ийг бүтнээр нь paste хийгээд **Run**. (Дахин ажиллуулахад аюулгүй.)
2. (Заавал биш) `supabase/seed.sql` — жишээ зуслан, ажил. Жинхэнэ жагсаалтаа CSV-ээр оруулах бол алгасна.
3. **Authentication → Sign In / Providers → Email**: дотоод хэрэгсэл тул "Confirm email"-ийг унтраавал бүртгүүлмэгц шууд нэвтэрнэ. Асаалттай бол баталгаажуулах имэйл очно.
4. `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
5. `npm run dev` → **Бүртгүүлэх** табаар багийн гишүүн бүр бүртгүүлнэ.

> Database password, `service_role` / secret key-г **хэзээ ч** кодод, `.env.local`-д бүү тавь — энэ апп зөвхөн publishable key ашиглана. Хамгаалалтыг RLS (Row Level Security) хийдэг: зөвхөн нэвтэрсэн хэрэглэгч өгөгдөл харна.

Анхаар: Supabase-д бүртгэлийг хэн ч нээж болно. Зөвхөн багийнхаа хүмүүсийг оруулахын тулд бүгд бүртгүүлсний дараа **Authentication → Sign In / Providers → "Allow new users to sign up"**-ийг унтраа.

## CSV импорт

Эхний мөр нь багануудын нэр. Танигдах нэрс (Монгол эсвэл англи):

`Нэр` · `Аймаг` · `Сум` · `Хаяг` · `Утас` · `Имэйл` · `Холбоо барих хүн` · `Facebook` · `Вэбсайт` · `Нас доод` · `Нас дээд` · `Багтаамж` · `Үнэ` · `Тайлбар` · `Зураг` · `Тэмдэглэл` · `Төлөв` · `lat` · `lng`

Ижил нэртэй зуслан давхар орохгүй. Google Sheets → File → Download → CSV.

## Бүтэц

```
src/
  app/(app)/          самбар, tasks, camps, reports
  app/login/          нэвтрэх / бүртгүүлэх
  components/board.tsx  дахин ашиглах drag-and-drop Kanban
  lib/data/           store (optimistic UI), supabase-repo, demo-repo
  lib/completeness.ts мэдээллийн бүрэн байдлын дүрэм
  proxy.ts            session шинэчлэх, нэвтрээгүйг /login руу
supabase/
  schema.sql          хүснэгт, enum, trigger, RLS, realtime
  seed.sql            жишээ өгөгдөл
```

## Deploy (Vercel)

GitHub руу push → Vercel дээр import → Environment Variables-д дээрх 2 утгыг нэмнэ. Supabase → Authentication → URL Configuration-д Vercel домэйноо **Site URL** болгоно.
# zuca-todo
