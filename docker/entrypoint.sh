#!/bin/sh
set -eu

# 云托管会注入 MYSQL_ADDRESS / MYSQL_USERNAME / MYSQL_PASSWORD；
# 数据库名通常需要自行配置 MYSQL_DATABASE。
if [ -z "${DATABASE_URL:-}" ]; then
  : "${MYSQL_ADDRESS:?请设置 MYSQL_ADDRESS（host 或 host:port）}"
  : "${MYSQL_USERNAME:?请设置 MYSQL_USERNAME}"
  : "${MYSQL_PASSWORD:?请设置 MYSQL_PASSWORD}"
  : "${MYSQL_DATABASE:?请设置 MYSQL_DATABASE}"

  case "$MYSQL_ADDRESS" in
    *:*) ;;
    *) MYSQL_ADDRESS="$MYSQL_ADDRESS:3306" ;;
  esac

  enc() {
    node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"
  }

  export DATABASE_URL="mysql://$(enc "$MYSQL_USERNAME"):$(enc "$MYSQL_PASSWORD")@${MYSQL_ADDRESS}/$(enc "$MYSQL_DATABASE")?connection_limit=5&pool_timeout=20"
fi

echo "[entrypoint] prisma migrate deploy"
npx prisma migrate deploy

echo "[entrypoint] starting Next.js on port ${PORT:-80}"
exec npx next start -p "${PORT:-80}" -H 0.0.0.0
