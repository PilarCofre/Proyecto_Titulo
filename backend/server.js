const express  = require("express");
const cors     = require("cors");
const oracledb = require("oracledb");
const { getConnection } = require("./db/oracle");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.send("Backend funcionando"));

// TEST 
app.get("/api/test", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(`SELECT * FROM FSCU_VALOR_UTM`);
    res.json(result.rows);
  } catch (err) {
    console.error("Error /api/test:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});

// LOGIN 
app.post("/api/login", async (req, res) => {
  let conn;
  try {
    const { rut, password } = req.body;
    const rutNum = parseInt(rut.toString().replace(/\./g, "").split("-")[0]);
    conn = await getConnection();

    let result = await conn.execute(
      `SELECT f.RUT_FUNCIONARIO, f.NOMBRES || ' ' || f.PATERNO AS NOMBRE_COMPLETO
       FROM FSCU_FUNCIONARIO f
       WHERE f.RUT_FUNCIONARIO = :rut AND f.PASSWORD = :pwd`,
      { rut: rutNum, pwd: password },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length > 0) {
      const f = result.rows[0];
      return res.json({ success: true, tipo: "admin", rut: f.RUT_FUNCIONARIO, nombre: f.NOMBRE_COMPLETO });
    }

    result = await conn.execute(
      `SELECT d.RUT_DEUDOR, p.NOMBRES || ' ' || p.PATERNO AS NOMBRE_COMPLETO
       FROM FSCU_DEUDOR d JOIN FSCU_PERSONA p ON p.ID_PERSONA = d.ID_PERSONA
       WHERE d.RUT_DEUDOR = :rut AND d.PASSWORD = :pwd`,
      { rut: rutNum, pwd: password },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length > 0) {
      const u = result.rows[0];
      return res.json({ success: true, tipo: "usuario", rut: u.RUT_DEUDOR, nombre: u.NOMBRE_COMPLETO });
    }

    return res.json({ success: false });
  } catch (err) {
    console.error("Error /api/login:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});


app.get("/api/deudas/:rut", async (req, res) => {
  let conn;
  try {
    const rutNum = parseInt(req.params.rut);
    if (!rutNum) return res.status(400).json({ ok: false, error: "RUT inválido" });

    conn = await getConnection();

    // RESUMEN: suma capital vencido + intereses + cuotas futuras por RUT
    // DEUDA_CAPITAL = cuotas vencidas (≤ año actual)
    // TOTAL_SALDO_CUOTAS = cuotas futuras (> año actual)
    const resumenResult = await conn.execute(
      `SELECT
          SUM(v.DEUDA_CAPITAL)       AS DEUDA_CAPITAL,
          SUM(v.SALDO_PENAL)         AS SALDO_PENAL,
          SUM(v.TOTAL_SALDO_CUOTAS)  AS TOTAL_SALDO_CUOTAS,
          SUM(v.DEUDA_CAPITAL + v.SALDO_PENAL + v.TOTAL_SALDO_CUOTAS) AS TOTAL_DEUDA_GENERAL
       FROM V_SALDO_CUOTA v
       WHERE v.RUT_DEUDOR = :rut`,
      { rut: rutNum },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // DETALLE: por año con elegibilidad desde V_PUEDE_REPROGRAMAR
    const detalleResult = await conn.execute(
      `SELECT
          v.CODIGO_DEUDA,
          v.AGNO,
          v.DEUDA_CAPITAL,
          v.SALDO_PENAL,
          v.TOTAL_SALDO_CUOTAS,
          d.NRO_CUOTAS,
          d.AGNO_DEUDA_EXIGIBLE,
          vr.ESTADO_MORA,
          vr.ESTADO_MOROSIDAD,
          vr.MESES_MOROSOS,
          vr.SALDO_CAPITAL         AS VR_SALDO_CAPITAL,
          vr.SALDO_INTERESES_PENAL AS VR_SALDO_INTERESES
       FROM V_SALDO_CUOTA v
       LEFT JOIN FSCU_DEUDAS d  ON d.CODIGO_DEUDA = v.CODIGO_DEUDA
       LEFT JOIN V_PUEDE_REPROGRAMAR vr ON vr.CODIGO_DEUDA = v.CODIGO_DEUDA
       WHERE v.RUT_DEUDOR = :rut
       ORDER BY v.AGNO`,
      { rut: rutNum },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    // UTM más reciente
    const utmResult = await conn.execute(
      `SELECT VALOR_UTM FROM FSCU_VALOR_UTM
       ORDER BY AGNO DESC, MES DESC FETCH FIRST 1 ROWS ONLY`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const resumen = resumenResult.rows[0] ?? {
      DEUDA_CAPITAL: 0, SALDO_PENAL: 0,
      TOTAL_SALDO_CUOTAS: 0, TOTAL_DEUDA_GENERAL: 0
    };

    return res.json({
      ok:      true,
      resumen: [resumen],
      detalle: detalleResult.rows,
      utm:     utmResult.rows[0]?.VALOR_UTM ?? 68310
    });

  } catch (err) {
    console.error("Error GET /api/deudas:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    if (conn) {
      try { await conn.close(); } catch (e) { console.error(e); }
    }
  }
});

// GET PERSONA 
app.get("/api/persona/:rut", async (req, res) => {
  let conn;
  try {
    const rutNum = parseInt(req.params.rut);
    if (!rutNum) return res.status(400).json({ error: "RUT inválido" });
    conn = await getConnection();

    const resPer = await conn.execute(
      `SELECT p.PATERNO, p.MATERNO, p.NOMBRES, p.EMAIL
       FROM FSCU_PERSONA p JOIN FSCU_DEUDOR d ON d.ID_PERSONA = p.ID_PERSONA
       WHERE d.RUT_DEUDOR = :rut`,
      { rut: rutNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (resPer.rows.length === 0) return res.status(404).json({ error: "Persona no encontrada" });
    const per = resPer.rows[0];

    const resDir = await conn.execute(
      `SELECT dir.ID_DIRECCION, dir.DIRECCION, dir.NOMBRE_COMUNA, dir.REGION
       FROM FSCU_DIRECCION dir JOIN FSCU_DEUDOR d ON d.ID_PERSONA = dir.ID_PERSONA
       WHERE d.RUT_DEUDOR = :rut
       ORDER BY dir.FECHA_MODIF DESC NULLS LAST FETCH FIRST 1 ROWS ONLY`,
      { rut: rutNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const dir = resDir.rows[0] ?? {};

    const resCel = await conn.execute(
      `SELECT cel.ID_CELULAR, cel.NRO_CELULAR
       FROM FSCU_CELULAR cel JOIN FSCU_DEUDOR d ON d.ID_PERSONA = cel.ID_PERSONA
       WHERE d.RUT_DEUDOR = :rut
       ORDER BY cel.FECHA_MODIF DESC NULLS LAST FETCH FIRST 1 ROWS ONLY`,
      { rut: rutNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const cel = resCel.rows[0] ?? {};

    return res.json({
      apellido_pat:  per.PATERNO       ?? '',
      apellido_mat:  per.MATERNO       ?? '',
      nombres:       per.NOMBRES       ?? '',
      email:         per.EMAIL         ?? '',
      direccion:     dir.DIRECCION     ?? '',
      comuna:        dir.NOMBRE_COMUNA ?? '',
      region:        dir.REGION        ?? '',
      celular:       cel.NRO_CELULAR   ?? '',
      id_direccion:  dir.ID_DIRECCION  ?? null,
      id_celular:    cel.ID_CELULAR    ?? null,
    });
  } catch (err) {
    console.error("Error GET /api/persona:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});

// PUT PERSONA 
app.put("/api/persona/:rut", async (req, res) => {
  let conn;
  try {
    const rutNum = parseInt(req.params.rut);
    if (!rutNum) return res.status(400).json({ error: "RUT inválido" });
    const { direccion, comuna, region, celular, email, id_direccion, id_celular } = req.body;
    const hoy = new Date();
    conn = await getConnection();

    await conn.execute(
      `UPDATE FSCU_PERSONA p SET p.EMAIL = :email
       WHERE p.ID_PERSONA = (SELECT d.ID_PERSONA FROM FSCU_DEUDOR d WHERE d.RUT_DEUDOR = :rut)`,
      { email, rut: rutNum }
    );
    if (id_direccion) {
      await conn.execute(
        `UPDATE FSCU_DIRECCION SET DIRECCION=:dir, NOMBRE_COMUNA=:comuna, REGION=:region, FECHA_MODIF=:hoy WHERE ID_DIRECCION=:id`,
        { dir: direccion, comuna, region, hoy, id: id_direccion }
      );
    } else {
      await conn.execute(
        `INSERT INTO FSCU_DIRECCION (ID_PERSONA, DIRECCION, NOMBRE_COMUNA, REGION, FECHA_MODIF)
         SELECT d.ID_PERSONA, :dir, :comuna, :region, :hoy FROM FSCU_DEUDOR d WHERE d.RUT_DEUDOR = :rut`,
        { dir: direccion, comuna, region, hoy, rut: rutNum }
      );
    }
    if (id_celular) {
      await conn.execute(
        `UPDATE FSCU_CELULAR SET NRO_CELULAR=:cel, FECHA_MODIF=:hoy WHERE ID_CELULAR=:id`,
        { cel: celular, hoy, id: id_celular }
      );
    } else {
      await conn.execute(
        `INSERT INTO FSCU_CELULAR (ID_PERSONA, NRO_CELULAR, FECHA_MODIF)
         SELECT d.ID_PERSONA, :cel, :hoy FROM FSCU_DEUDOR d WHERE d.RUT_DEUDOR = :rut`,
        { cel: celular, hoy, rut: rutNum }
      );
    }
    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error("Error PUT /api/persona:", err.message);
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// POST SOLICITUD 
app.post("/api/solicitud", async (req, res) => {
  let conn;
  try {
    const {
      rut_deudor, codigo_deuda,
      deuda_capital, intereses_penales, deuda_total,
      monto_pago_inicial_pesos, monto_pago_inicial_utm, porcentaje_pago_inicial,
      porcentaje_condonacion, monto_condonado, saldo_reprogramar, plazo_anios,
    } = req.body;
    conn = await getConnection();

    const resUtm = await conn.execute(
      `SELECT AGNO, MES FROM FSCU_VALOR_UTM ORDER BY AGNO DESC, MES DESC FETCH FIRST 1 ROWS ONLY`,
      {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const utm = resUtm.rows[0];
    const fechaLimite = new Date();
    fechaLimite.setDate(fechaLimite.getDate() + 30);

    await conn.execute(
      `INSERT INTO FSCU_SOLICITUD_REPROGRAMACION (
          RUT_DEUDOR, CODIGO_DEUDA, UTM_AGNO, UTM_MES,
          FECHA_SOLICITUD, ESTADO,
          DEUDA_CAPITAL, INTERESES_PENALES_TOTAL, DEUDA_TOTAL,
          PORCENTAJE_PAGO_INICIAL, MONTO_PAGO_INICIAL_UTM, MONTO_PAGO_INICIAL_PESOS,
          PORCENTAJE_CONDONACION, MONTO_CONDONADO,
          SALDO_REPROGRAMAR, PLAZO_ANIOS,
          FECHA_LIMITE_REPROGRAMACION, FECHA_ACTUALIZACION
       ) VALUES (
          :rut, :cod, :utm_agno, :utm_mes,
          SYSDATE, 'PENDIENTE',
          :capital, :intereses, :total,
          :pct_pie, :pie_utm, :pie_pesos,
          :pct_cond, :monto_cond,
          :saldo, :plazo, :fecha_limite, SYSDATE
       )`,
      {
        rut: rut_deudor, cod: codigo_deuda,
        utm_agno: utm.AGNO, utm_mes: utm.MES,
        capital: deuda_capital, intereses: intereses_penales, total: deuda_total,
        pct_pie: porcentaje_pago_inicial, pie_utm: monto_pago_inicial_utm, pie_pesos: monto_pago_inicial_pesos,
        pct_cond: porcentaje_condonacion, monto_cond: monto_condonado,
        saldo: saldo_reprogramar, plazo: plazo_anios, fecha_limite: fechaLimite,
      }
    );
    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error("Error POST /api/solicitud:", err.message);
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// GET SOLICITUD POR RUT (deudor) 
app.get("/api/solicitud/:rut", async (req, res) => {
  let conn;
  try {
    const rutNum = parseInt(req.params.rut);
    if (!rutNum) return res.status(400).json({ error: "RUT inválido" });
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT s.ID_SOLICITUD, s.FECHA_SOLICITUD, s.FECHA_LIMITE_REPROGRAMACION,
              s.ESTADO, s.MONTO_PAGO_INICIAL_PESOS AS PIE,
              s.SALDO_REPROGRAMAR AS TOTAL_REPROGRAM,
              s.PLAZO_ANIOS AS CUOTAS, s.FECHA_ACTUALIZACION, p.EMAIL
       FROM FSCU_SOLICITUD_REPROGRAMACION s
       JOIN FSCU_DEUDOR  d ON d.RUT_DEUDOR = s.RUT_DEUDOR
       JOIN FSCU_PERSONA p ON p.ID_PERSONA  = d.ID_PERSONA
       WHERE s.RUT_DEUDOR = :rut
       ORDER BY s.FECHA_SOLICITUD DESC FETCH FIRST 1 ROWS ONLY`,
      { rut: rutNum }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length === 0) return res.json(null);

    const r = result.rows[0];
    const cuotaAnual = r.CUOTAS > 0 ? Math.ceil(r.TOTAL_REPROGRAM / r.CUOTAS) : 0;
    const fmtF  = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—'
    const fmtFH = (d) => d ? new Date(d).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : null

    return res.json({
      id:                 r.ID_SOLICITUD,
      numero:             `SOL-${new Date(r.FECHA_SOLICITUD).getFullYear()}-${String(r.ID_SOLICITUD).padStart(6, '0')}`,
      estado:             r.ESTADO,
      fechaEnvio:         fmtF(r.FECHA_SOLICITUD),
      fechaEnvioHora:     fmtFH(r.FECHA_SOLICITUD),
      fechaLimite:        fmtF(r.FECHA_LIMITE_REPROGRAMACION),
      fechaActualizacion: fmtFH(r.FECHA_ACTUALIZACION),
      email:              r.EMAIL,
      pie:                r.PIE,
      totalReprogram:     r.TOTAL_REPROGRAM,
      cuotas:             r.CUOTAS,
      cuotaAnual,
    });
  } catch (err) {
    console.error("Error GET /api/solicitud/:rut:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});

// GET SOLICITUD POR ID (admin) 
app.get("/api/solicitudes/:id", async (req, res) => {
  let conn;
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: "ID inválido" });
    conn = await getConnection();

    const result = await conn.execute(
      `SELECT
          s.ID_SOLICITUD, s.RUT_DEUDOR, s.CODIGO_DEUDA,
          s.FECHA_SOLICITUD, s.FECHA_LIMITE_REPROGRAMACION,
          s.ESTADO, s.OBSERVACIONES,
          s.DEUDA_CAPITAL, s.INTERESES_PENALES_TOTAL,
          s.DEUDA_TOTAL, s.MONTO_PAGO_INICIAL_PESOS,
          s.MONTO_PAGO_INICIAL_UTM, s.PORCENTAJE_PAGO_INICIAL,
          s.PORCENTAJE_CONDONACION, s.MONTO_CONDONADO,
          s.SALDO_REPROGRAMAR, s.PLAZO_ANIOS,
          p.NOMBRES || ' ' || p.PATERNO || ' ' || p.MATERNO AS NOMBRE,
          p.EMAIL,
          dir.DIRECCION, dir.NOMBRE_COMUNA, dir.REGION,
          cel.NRO_CELULAR
       FROM FSCU_SOLICITUD_REPROGRAMACION s
       JOIN FSCU_DEUDOR d ON d.RUT_DEUDOR = s.RUT_DEUDOR
       JOIN FSCU_PERSONA p ON p.ID_PERSONA = d.ID_PERSONA
       LEFT JOIN FSCU_DIRECCION dir ON dir.ID_PERSONA = d.ID_PERSONA
          AND dir.ID_DIRECCION = (SELECT MAX(ID_DIRECCION) FROM FSCU_DIRECCION WHERE ID_PERSONA = d.ID_PERSONA)
       LEFT JOIN FSCU_CELULAR cel ON cel.ID_PERSONA = d.ID_PERSONA
          AND cel.ID_CELULAR = (SELECT MAX(ID_CELULAR) FROM FSCU_CELULAR WHERE ID_PERSONA = d.ID_PERSONA)
       WHERE s.ID_SOLICITUD = :id`,
      { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Solicitud no encontrada" });

    const r = result.rows[0];
    const fmtF = (d) => d ? new Date(d).toLocaleDateString('es-CL') : '—'
    const cuotaAnual = r.PLAZO_ANIOS > 0 ? Math.ceil(r.SALDO_REPROGRAMAR / r.PLAZO_ANIOS) : 0

    return res.json({
      id:               r.ID_SOLICITUD,
      numero:           `SOL-${new Date(r.FECHA_SOLICITUD).getFullYear()}-${String(r.ID_SOLICITUD).padStart(6, '0')}`,
      rut:              r.RUT_DEUDOR,
      nombre:           r.NOMBRE,
      email:            r.EMAIL,
      celular:          r.NRO_CELULAR   ?? '—',
      direccion:        r.DIRECCION     ?? '—',
      comuna:           r.NOMBRE_COMUNA ?? '—',
      region:           r.REGION        ?? '—',
      codigoDeuda:      r.CODIGO_DEUDA,
      estado:           r.ESTADO,
      observaciones:    r.OBSERVACIONES ?? '',
      fechaSolicitud:   fmtF(r.FECHA_SOLICITUD),
      fechaLimite:      fmtF(r.FECHA_LIMITE_REPROGRAMACION),
      deudaCapital:     r.DEUDA_CAPITAL,
      intereses:        r.INTERESES_PENALES_TOTAL,
      deudaTotal:       r.DEUDA_TOTAL,
      pie:              r.MONTO_PAGO_INICIAL_PESOS,
      pieUTM:           r.MONTO_PAGO_INICIAL_UTM,
      pctPie:           r.PORCENTAJE_PAGO_INICIAL,
      pctCondonacion:   r.PORCENTAJE_CONDONACION,
      montoCondonado:   r.MONTO_CONDONADO,
      saldoReprogramar: r.SALDO_REPROGRAMAR,
      plazoAnios:       r.PLAZO_ANIOS,
      cuotaAnual,
    });
  } catch (err) {
    console.error("Error GET /api/solicitudes/:id:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});

// PUT ESTADO SOLICITUD (admin) 
app.put("/api/solicitudes/:id/estado", async (req, res) => {
  let conn;
  try {
    const id = parseInt(req.params.id);
    const { estado, observaciones, rut_funcionario } = req.body;

    // ACTIVADA permite confirmar que el deudor firmó el pagaré y pagó el pie
    if (!['APROBADA', 'RECHAZADA', 'ACTIVADA'].includes(estado))
      return res.status(400).json({ error: "Estado inválido" });

    conn = await getConnection();

    await conn.execute(
      `UPDATE FSCU_SOLICITUD_REPROGRAMACION
       SET ESTADO=:estado, OBSERVACIONES=:obs, RUT_FUNCIONARIO=:rut_func, FECHA_ACTUALIZACION=SYSDATE
       WHERE ID_SOLICITUD=:id`,
      { estado, obs: observaciones ?? null, rut_func: rut_funcionario, id }
    );
    await conn.commit();
    return res.json({ success: true });
  } catch (err) {
    console.error("Error PUT estado:", err.message);
    if (conn) await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// GET SOLICITUDES (lista admin) 
app.get("/api/solicitudes", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT s.ID_SOLICITUD, s.RUT_DEUDOR,
              p.NOMBRES || ' ' || p.PATERNO || ' ' || p.MATERNO AS NOMBRE,
              s.DEUDA_TOTAL, s.MONTO_PAGO_INICIAL_PESOS AS PIE,
              s.FECHA_LIMITE_REPROGRAMACION, s.ESTADO
       FROM FSCU_SOLICITUD_REPROGRAMACION s
       JOIN FSCU_DEUDOR  d ON d.RUT_DEUDOR = s.RUT_DEUDOR
       JOIN FSCU_PERSONA p ON p.ID_PERSONA  = d.ID_PERSONA
       ORDER BY s.FECHA_SOLICITUD DESC`,
      {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return res.json(result.rows.map(r => ({
      id:         r.ID_SOLICITUD,
      rut:        r.RUT_DEUDOR,
      nombre:     r.NOMBRE,
      totalDeuda: r.DEUDA_TOTAL,
      pie:        r.PIE,
      fechaLimite: r.FECHA_LIMITE_REPROGRAMACION
        ? new Date(r.FECHA_LIMITE_REPROGRAMACION).toLocaleDateString('es-CL') : '—',
      estado: r.ESTADO.charAt(0).toUpperCase() + r.ESTADO.slice(1).toLowerCase(),
    })));
  } catch (err) {
    console.error("Error GET /api/solicitudes:", err.message);
    res.status(500).send("Error en BD");
  } finally {
    if (conn) await conn.close();
  }
});

//  SERVIDOR 
app.listen(3000, () => console.log("Servidor corriendo en http://localhost:3000"));