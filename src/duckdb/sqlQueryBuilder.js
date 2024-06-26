const getColumnsQuery = (filesUrls) => {
  const filesAsString = getUrlsArrayForSQLQuery(
    filesUrls,
  );
  return `SELECT * FROM read_parquet(${filesAsString}) LIMIT 0`;
};

const getStationsNamesAndIdsQuery = (filesUrls) => {
  const filesAsString = getUrlsArrayForSQLQuery(
    filesUrls,
  );
  //   return `SELECT NOM_USUEL, NUM_POSTE FROM read_parquet(${filesAsString}) GROUP BY NUM_POSTE, NOM_USUEL ORDER BY NOM_USUEL`;
  return `SELECT DISTINCT NOM_USUEL FROM read_parquet(${filesAsString}) ORDER BY NOM_USUEL`;
};

const getUrlsArrayForSQLQuery = (array) => {
  const urlsAsString = `['${array.join("', '")}']`;
  return urlsAsString;
};

const getColumnsForSQLQuery = (array) => {
  const columnsStr = `"${array.join('","')}"`;
  return columnsStr;
};

const getDatesConditionForSQLQuery = (dateColumn, startDate, endDate) => {
  const dateLength = dateColumn.length;
  // For hourly data, add 00 at the end
  let prefix = "";
  if (dateLength === 10) {
    prefix = "00";
  }

  const formattedStartDateValue = startDate.replaceAll("-", "").slice(
    0,
    dateLength,
  ) + prefix;
  const startDateCondition = `${dateColumn}>=${formattedStartDateValue}`;

  const formattedEndDateValue = endDate.replaceAll("-", "").slice(
    0,
    dateLength,
  ) + prefix;
  const endDateCondition = `${dateColumn}<=${formattedEndDateValue}`;

  const datesCondition = `${startDateCondition} AND ${endDateCondition}`;
  return datesCondition;
};

const buildQuery = (
  columns,
  parquerUrls,
  stationName,
  dateColumn,
  startDate,
  endDate,
) => {
  const columnsStr = getColumnsForSQLQuery(columns);
  const urlsArray = getUrlsArrayForSQLQuery(parquerUrls);

  const stationNameWhere = `NOM_USUEL='${stationName}'`;
  const datesWhereCondition = getDatesConditionForSQLQuery(
    dateColumn,
    startDate,
    endDate,
  );

  const fullQuery =
    `SELECT ${columnsStr} from read_parquet(${urlsArray}) WHERE ${stationNameWhere} AND ${datesWhereCondition} ORDER BY ${dateColumn}`;
  return fullQuery;
};

export default {
  getColumnsQuery,
  getUrlsArrayForSQLQuery,
  getColumnsForSQLQuery,
  getDatesConditionForSQLQuery,
  getStationsNamesAndIdsQuery,
  buildQuery,
};
