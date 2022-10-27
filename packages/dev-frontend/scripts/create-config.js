const { writeFileSync } = require("fs");

const frontendTag = process.env.FRONTEND_TAG;

writeFileSync("public/config.json", "{\"frontendTag\":\"" + frontendTag + "\"}");
