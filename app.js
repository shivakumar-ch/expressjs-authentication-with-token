const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

initializeAndRunServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server is running at http://localhost:3000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeAndRunServer();

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];

  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_SERVER", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  checkUserQuery = `
        SELECT * FROM user WHERE username='${username}';
    `;
  const dbResponse = await db.get(checkUserQuery);
  if (dbResponse !== undefined) {
    const isPasswordMatch = await bcrypt.compare(password, dbResponse.password);
    if (isPasswordMatch === true) {
      const jwtToken = jwt.sign(username, "MY_SERVER");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//get states list using GET
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
        SELECT * FROM state
    `;
  const allStatesResponse = await db.all(getStatesQuery);
  response.send(
    allStatesResponse.map((state) => ({
      stateId: state.state_id,
      stateName: state.state_name,
      population: state.population,
    }))
  );
});

//get specific state using GET
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
        SELECT * FROM state WHERE state_id=${stateId}
    `;
  const allStatesResponse = await db.get(getStatesQuery);
  response.send({
    stateId: allStatesResponse.state_id,
    stateName: allStatesResponse.state_name,
    population: allStatesResponse.population,
  });
});

//add district using POST
app.post("/districts/", authenticateToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const getStatesQuery = `
        INSERT INTO district 
            (
                district_name,
                state_id,
                cases,
                cured,
                active,
                deaths
            )
        VALUES
            (
                '${districtName}',
                ${stateId},
                ${cases},
                ${cured},
                ${active},
                ${deaths}
            );
            
    `;
  await db.run(getStatesQuery);
  response.send("District Successfully Added");
});

//get specific district using GET
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStatesQuery = `
        SELECT * FROM district WHERE district_id=${districtId}
    `;
    const district = await db.get(getStatesQuery);
    response.send({
      districtId: district.district_id,
      districtName: district.district_name,
      stateId: district.state_id,
      cases: district.cases,
      cured: district.cured,
      active: district.active,
      deaths: district.deaths,
    });
  }
);

//delete specific district using delete
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStatesQuery = `
        DELETE FROM district WHERE district_id=${districtId}
    `;
    await db.run(getStatesQuery);
    response.send("District Removed");
  }
);

//update specific district using put
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const districtDetails = request.body;
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const getStatesQuery = `
    UPDATE district 
    SET 
        district_name='${districtName}',
        state_id=${stateId},
        cases=${cases},
        cured=${cured},
        active=${active},
        deaths=${deaths}
    WHERE district_id=${districtId};
  `;
    await db.run(getStatesQuery);
    response.send("District Details Updated");
  }
);

//get specific state's statistics using GET
const getStatsOfState = (districts) => {
  let totalCases = 0;
  let totalCured = 0;
  let totalActive = 0;
  let totalDeaths = 0;

  for (let district of districts) {
    totalCases += district.cases;
    totalCured += district.cured;
    totalActive += district.active;
    totalDeaths += district.deaths;
  }

  return { totalCases, totalCured, totalActive, totalDeaths };
};

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesQuery = `
        SELECT * FROM district WHERE state_id=${stateId}
    `;
    const districtsResponse = await db.all(getStatesQuery);

    response.send(getStatsOfState(districtsResponse));
  }
);

module.exports = app;
