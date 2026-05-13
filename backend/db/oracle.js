const oracledb = require("oracledb");

async function getConnection() {
  try {
    return await oracledb.getConnection({
      user: "USER_FSCU",
      password: "FSCU2510##",
      connectString: "localhost/XEPDB1"
    });
  } catch (err) {
    console.error("Error conectando a Oracle:", err);
  }
}

module.exports = { getConnection };