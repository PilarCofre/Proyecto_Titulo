const oracledb = require("oracledb");

async function getConnection() {
  try {
    return await oracledb.getConnection({
      user: "C##PRUEBA_FSCU",
      password: "clave123",
      connectString: "localhost/XE"
    });
  } catch (err) {
    console.error("Error conectando a Oracle:", err);
  }
}

module.exports = { getConnection };