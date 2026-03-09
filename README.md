# Radio Recognition Telegram Bot 📻🎵

Телеграм-бот для автоматического распознавания музыки в реальном времени из HLS-потока радиостанции. Бот захватывает сегменты аудио, конвертирует их и использует API (ACRCloud/AudD) для определения текущего трека.

---

## 🚀 Основные возможности

- **HLS Stream Capture**: Захват живого потока радио (m3u8).
- **Audio Processing**: Использование FFmpeg для извлечения аудио без потери качества.
- **Dual Recognition**: Поддержка интеграции с ACRCloud и AudD API.
- **Auto-Cleanup**: Автоматическое удаление временных файлов из системной директории (`os.tmpdir`).
- **Docker Ready**: Оптимизированный Dockerfile на базе Alpine Linux для работы на слабых серверах (VPS).

---

## 🛠 Технологический стек

- **Runtime**: Node.js (ES Modules)
- **Audio**: FFmpeg
- **Containerization**: Docker, Docker Compose
- **API**: Telegram Bot API, ACRCloud API

---

## 📋 Предварительные требования

1. **Docker** и **Docker Compose** установленные на сервере.
2. API ключи от **ACRCloud** или **AudD**.
3. Токен телеграм-бота от **@BotFather**.

---

## ⚙️ Установка и запуск

### 1. Клонирование репозитория

```bash
git clone <ваш-url-репозитория>
cd radioshow
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корневой папке:

```env
# Telegram
TELEGRAM_TOKEN=ваш_токен_бота
CHAT_ID=id_вашего_чата, еще_один_id

# ACRCloud
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=ваш_ключ
ACRCLOUD_ACCESS_SECRET=ваш_секрет

# AudD (если используется)
AUDD_API_KEY=ваш_ключ

# Radio Stream Configuration - UPDATE THIS IF THE STREAM URL CHANGES
# Find the current stream URL from autoradio.ru or contact their support
RADIO_STREAM_URL=https://actual-stream-url.m3u8
BITRATE_PATH=128

# Environment
NODE_ENV=production

```

### 3. Запуск через Docker Compose

```bash
# Сборка и запуск в фоновом режиме
docker-compose up -d --build

```

---

## 📝 Команды управления

| Задача                    | Команда                        |
| ------------------------- | ------------------------------ |
| **Посмотреть логи**       | `docker-compose logs -f`       |
| **Остановить бота**       | `docker-compose down`          |
| **Обновить код**          | `docker-compose up -d --build` |
| **Очистить мусор Docker** | `docker system prune -a`       |

---

## ⚙️ Как это работает (Workflow)

1. Бот каждые 40 секунд скачивает 5-секундный фрагмент HLS-потока.
2. Фрагмент сохраняется во временную директорию ОС (`/tmp` на Linux/Docker).
3. **FFmpeg** конвертирует `.ts` сегмент в `.mp3`.
4. Аудиофайл отправляется на анализ в API распознавания.
5. Если найден новый трек (отличается от предыдущего), бот отправляет уведомление в Telegram.
6. В блоке `finally` все временные файлы удаляются, освобождая место.

---

## ⚠️ Важные примечания

- **Место на диске**: Проект оптимизирован для работы на дисках малого объема (от 7 ГБ). Все временные файлы обрабатываются в RAM через папку `/tmp`.
- **Лимиты API**: Частота проверок (40с) настроена для соблюдения лимитов бесплатных/дешевых тарифов API распознавания.

## 🔧 Решение проблем

### Ошибка "Segment loading error: Request failed with status code 400"

Эта ошибка обычно означает, что URL стрима больше не действителен. Для решения проблемы:

1. Найдите новый URL HLS-стрима на официальном сайте радиостанции
2. Обновите переменную `RADIO_STREAM_URL` в файле `.env`
3. Убедитесь, что URL заканчивается на `.m3u8` и доступен для чтения

Если вы не можете найти новый URL стрима, обратитесь к администрации радиостанции за актуальной информацией.
