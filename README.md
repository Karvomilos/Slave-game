# ПОДОПЫТНЫЙ 001

Telegram Mini App: HTML/CSS/JavaScript, FastAPI, aiogram 3 и PostgreSQL в Supabase. SQLite не используется.

## Что внутри

- `index.html`, `style.css`, `script.js` — игра и мобильный интерфейс.
- `main.py` — API, рефералы, платежи и Telegram-бот.
- `db.py` — подключение к Supabase PostgreSQL и создание таблиц.
- `payments.py` — создание и серверная проверка платежей ЮKassa.
- `render.yaml` — Render Blueprint для Web Service.
- `token.txt` и `supabase_url.txt` — локальные секреты; в Git не добавляются.

Реферальная ссылка выдаёт новому игроку 10 клятв, а пригласившему — 25. Бонус начисляется один раз при первом входе приглашённого игрока. Самоприглашение не учитывается.

## Локальный запуск

Требуется Python 3.11 или новее. Установите зависимости:

```powershell
py -m pip install -r requirements.txt
```

В файле `supabase_url.txt` замените `[YOUR-PASSWORD]` на пароль базы Supabase. Если пароль содержит специальные символы, закодируйте их для URL. Вместо файла можно задать переменную окружения:

```powershell
$env:DATABASE_URL="postgresql://postgres:PASSWORD@db.ogxbyxxydbomgoemaqan.supabase.co:5432/postgres"
$env:RUN_BOT="0"
py main.py
```

Откройте <http://127.0.0.1:8000>. Для запуска бота уберите `RUN_BOT=0`, поместите токен в `token.txt` и задайте HTTPS-адрес игры через `GAME_URL`.

Таблицы создаются автоматически при старте. Существующие данные из старой локальной SQLite автоматически не переносятся.

## Как залить код на GitHub

1. Создайте пустой репозиторий на GitHub без README.
2. В папке проекта выполните, подставив адрес своего репозитория:

```powershell
git init
git add .
git commit -m "Deploy game"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

`token.txt`, `supabase_url.txt`, `game_url.txt`, `database.db` и `.tools/` перечислены в `.gitignore`. Проверьте перед push, что токен, пароль и ключи не попали в файлы проекта. Пример настроек без секретов находится в `.env.example`.

## Запуск на Render

1. В Render выберите **New + → Blueprint** и подключите GitHub-репозиторий.
2. Render найдёт `render.yaml` и предложит создать Web Service `podopytny-001`. Отдельная база Render не нужна.
3. В **Environment** задайте `DATABASE_URL` с реальным паролем Supabase и `BOT_TOKEN`. `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY` можно заполнить позже.
4. Запустите Blueprint. Persistent Disk не нужен: прогресс хранится в Supabase.
5. После деплоя откройте `https://podopytny-001.onrender.com/api/health`. Ожидаемый ответ: `{"status":"ok","database":"postgresql"}`.
6. Отправьте боту `/start`. Кнопка «Воспитать» откроет игру.

Если изменили имя сервиса в `render.yaml`, также измените `GAME_URL` и `FRONTEND_URLS` на фактический HTTPS-адрес. Не запускайте одновременно локального бота и Render-бота с одним токеном: Telegram не допускает два polling-процесса.

Схема PostgreSQL обновляется при старте приложения, поэтому прогресс не зависит от жизненного цикла контейнера.

## ЮKassa

Кнопка **Донат**, покупка клятв и VIP уже подключены к серверному API. В Render задайте:

- `YOOKASSA_SHOP_ID` — shopId магазина;
- `YOOKASSA_SECRET_KEY` — секретный ключ API.

В кабинете ЮKassa укажите webhook:

```text
https://podopytny-001.onrender.com/api/payments/yookassa
```

Нужно событие `payment.succeeded`; событие об отмене также обрабатывается. Приложение не доверяет содержимому webhook: оно повторно запрашивает платёж у ЮKassa и начисляет товар только после подтверждения. Повторная доставка webhook не дублирует начисление. Ключи используются только на backend и не попадают в браузер.

## API

- `POST /api/load_data` — создаёт игрока, применяет `referrer_id` при первом входе и возвращает прогресс.
- `POST /api/save_data` — сохраняет прогресс.
- `POST /api/referral` — возвращает ссылку и число приглашений.
- `POST /api/payments/create` — создаёт платёж для `gems_10`, `gems_60`, `gems_150` или `vip`.
- `POST /api/payments/yookassa` — проверенный webhook начисления.
- `GET /api/leaderboard` — таблицы лидеров.
- `GET /api/health` — проверка API и подключения к базе.

Запросы с игровыми данными требуют подписанный Telegram `initData`.
