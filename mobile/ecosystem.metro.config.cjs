module.exports = {
  apps: [
    {
      name: "portal-expo",

      cwd: "/opt/portal/mobile",

      script: "/bin/bash",

      args: [
        "-lc",
        "exec npx expo start --go --lan --clear --port 8081"
      ],

      interpreter: "none",

      autorestart: true,

      restart_delay: 3000,

      max_restarts: 20,

      kill_timeout: 10000,

      env: {
        NODE_OPTIONS:
          "--max-old-space-size=1024",

        REACT_NATIVE_PACKAGER_HOSTNAME:
          "217.114.1.149",

        EXPO_PACKAGER_PROXY_URL:
          "http://217.114.1.149:8081"
      }
    }
  ]
};
