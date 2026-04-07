module.exports = {
  apps: [
    {
      name: "scrape-translation-of-abu-iyaad",
      script: "scripts/scrape-cron.sh",
      cwd: "/home/ammar/quran-app",
      interpreter: "/bin/bash",
      // Daily at 2 AM — lock file prevents overlap if previous run is still going
      cron_restart: "0 2 * * *",
      autorestart: false,
      watch: false,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "logs/scrape-translation-of-abu-iyaad-pm2-error.log",
      out_file: "logs/scrape-translation-of-abu-iyaad-pm2-out.log",
      merge_logs: true,
    },
  ],
};
