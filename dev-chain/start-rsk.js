const { spawnSync } = require("child_process");

spawnSync("docker", [
  "run",
  "-d",
  "--rm",
  ...["--name", "regtest-node-01"],
  ...["-p", "4444:4444"],
  ...["-p", "30305:30305"],
  // ...["-v", `${__dirname}:/dev-chain`],

  "regtest",

  // ...["--config", "/dev-chain/config.toml"]
]);
