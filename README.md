# eldes-client

Веб-приложение для просмотра журнала событий устройств-шлагбаумов ТСН "МР17дом1".

Работает в паре с [eldes-api](https://github.com/lobanovsky/eldes-api).

## Функционал

- Авторизация по email и паролю
- Выбор устройства из списка (сгруппированы по зонам)
- Фильтрация событий по диапазону дат (по умолчанию — последние 7 дней)
- Таблица событий: время, имя, телефон
- Синхронизация событий с Eldes API
- Пагинация (50 записей на страницу)

## Локальный запуск

Бэкенд должен быть запущен на `http://localhost:8080`.

```bash
python3 -m http.server 3000
```

Открыть: http://localhost:3000

## Структура

```
eldes-client/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── api.js      # HTTP-клиент, JWT
│   ├── auth.js     # Логин / логаут
│   ├── logs.js     # Устройства, логи, пагинация, синхронизация
│   └── app.js      # Инициализация
├── docker/
│   ├── nginx.conf
│   └── entrypoint.sh
└── Dockerfile
```

## Docker

Образ собирается на базе `nginx:alpine`. При старте контейнера `entrypoint.sh` подставляет адрес API через переменную окружения:

```bash
docker build -t eldes-client .
docker run -p 8092:80 -e ELDES_API_URL=http://api-host:8080 eldes-client
```

### docker-compose

```bash
# Создать .env
echo "TAG=latest" > .env
echo "DOCKER_USERNAME=your_username" >> .env
echo "ELDES_API_URL=http://api-host:8080" >> .env

docker compose up -d
```

Приложение будет доступно на порту `8092`.

## CI/CD

При пуше в `master` GitHub Actions автоматически:
1. Собирает Docker-образ с тегом из короткого SHA коммита
2. Пушит в DockerHub
3. Разворачивает на сервере через SSH

### Секреты GitHub Actions

| Секрет | Описание |
|---|---|
| `DOCKER_USERNAME` | Логин DockerHub |
| `DOCKER_PASSWORD` | Пароль DockerHub |
| `DOCKER_TOKEN` | Токен DockerHub (для pull на сервере) |
| `DEPLOY_HOST` | IP-адрес сервера |
| `DEPLOY_USER` | SSH-пользователь |
| `DEPLOY_SSH_KEY` | Приватный SSH-ключ |
| `DEPLOY_DIR` | Путь на сервере для docker-compose |
| `ELDES_API_URL` | URL бэкенда (eldes-api) |
