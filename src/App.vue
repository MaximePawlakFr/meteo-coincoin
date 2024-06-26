<script setup>
import { ref } from "vue"
import DatasetForm from "./components/DatasetForm.vue"
import AppFooter from "./components/AppFooter.vue"
import AppPlot from "./components/AppPlot.vue"
import Loader from "./components/Loader.vue"
import { runQuery } from "./duckdb/dataClient.js"
import { useDailyDataStore } from "./stores/dailyData"
import { storeToRefs } from "pinia"
import fiches from "./datasets/meteoFrance/fiches-stations.js"
import perspective from "https://cdn.jsdelivr.net/npm/@finos/perspective/dist/cdn/perspective.js"
import posthog from "posthog-js"
const ENV = import.meta.env
const POSTHOG_KEY = ENV.VITE_POSTHOG_KEY
const POSTHOG_HOST = ENV.VITE_POSTHOG_HOST
import BrevoForm from "./components/BrevoForm.vue"
import AppNav from "./components/AppNav.vue"
import Papa from "papaparse"

// Init only for prod to avoir sending false signals
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST //"https://eu.i.posthog.com"
  })
}

const worker = perspective.worker()
const viewer = ref(null)
// const userId = localStorage.getItem("userId")
// const userIdCreatedAt = localStorage.getItem("userIdCreatedAt")
// console.log({ userId, userIdCreatedAt })
// if (!userId) {
//   const now = new Date().toISOString()
//   generateFingerprint(now).then((ff) => {
//     console.log(ff)
//     // Writing to localStorage
//     localStorage.setItem("userId", ff)
//     localStorage.setItem("userIdCreatedAt", now)
//   })
// }

const rawData = ref(null)
const data = ref(null)
const dates = ref(null)
const dateColumn = ref(null)
const stationColumns = ref(null)
const title = ref(0)
const showModal = ref(false)

const dailyDataStore = useDailyDataStore()
const { isFetchingData } = storeToRefs(dailyDataStore)

const isGraphReady = ref(false)

function submit(form) {
  const { dataset, columns, stationName, startDate, endDate } = form
  dateColumn.value = dataset.columns.date
  stationColumns.value = dataset.columns.station

  posthog.capture("fetchData", { dataset: dataset.name, columns, stationName, startDate, endDate })

  console.log("submit", form)
  isGraphReady.value = false
  return runQuery(form).then((res) => {
    console.log({ res })

    dates.value = res.dates
    data.value = res.data
    rawData.value = res.rawData
    title.value = `${stationName} - ${startDate} -> ${endDate}`

    isGraphReady.value = true
    dailyDataStore.setIsFetchingData(false)

    const workerData = worker.table(res.data)
    viewer.value.load(workerData)
  })
}

const stationsNames = []
const stationsIds = []

// Init stations
const stations = fiches.features.map((feature) => {
  const { NOM_USUEL, NUM_POSTE, NUM_DEP } = feature.properties
  stationsNames.push(NOM_USUEL)
  stationsIds.push(NUM_POSTE)

  const station = {
    name: NOM_USUEL,
    id: NUM_POSTE,
    department: NUM_DEP > 9 ? "" + NUM_DEP : "0" + NUM_DEP
  }
  return station
})
stations.sort((a, b) => {
  if (a.id >= b.id) {
    return 1
  } else {
    return -1
  }
})
dailyDataStore.setStations(stations)

const toggleShowModal = (show = false) => {
  if (typeof show === "boolean") {
    showModal.value = show
  } else {
    showModal.value = !showModal.value
  }
}

const onClickSignUpButton = () => {
  toggleShowModal(true)
}
const downloadData = (format) => {
  posthog.capture("downloadData", { format, title: title.value })

  if (format === "CSV") {
    const rawDataAsCsv = Papa.unparse(rawData.value)

    const blob = new Blob([rawDataAsCsv], { type: "text/csv;charset=utf-8," })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `MISTER_METEO_${title.value}.csv`
    // Trigger the download by clicking the anchor tag
    a.click()
  } else if (format === "JSON") {
    const dataAsString = JSON.stringify(
      rawData.value,
      (key, value) => (typeof value === "bigint" ? value.toString() : value) // return everything else unchanged
    )
    const blob = new Blob([dataAsString], { type: "text/json;charset=utf-8," })
    const dataAsUrl = URL.createObjectURL(blob)

    const a = document.createElement("a")
    a.href = dataAsUrl
    a.download = `MISTER_METEO_${title.value}.json`
    // Trigger the download by clicking the anchor tag
    a.click()
  }
}
</script>

<template>
  <AppNav @onClickSignUpButton="onClickSignUpButton"></AppNav>
  <header class="">
    <h1 class="text-2xl sm:text-6xl text-center">
      {{ $t("message.title1_line1") }}
      <br />
      {{ $t("message.title1_line2") }}
    </h1>
    <h2 class="my-8 text-lg font-thin text-center">
      <span class="my-4 block" title="Mister Meteo">{{ $t("message.title2") }}</span>
    </h2>
  </header>

  <main class="flex-1 mt-32 flex flex-col">
    <div class="container mx-auto">
      <DatasetForm @submit="submit" />
    </div>

    <div class="grow flex flex-col justify-center my-4">
      <div v-show="isGraphReady && !isFetchingData" class="flex flex-col">
        <AppPlot
          :data="data"
          :dates="dates"
          :dateColumn="dateColumn"
          :stationColumns="stationColumns"
          :title="title"
        />
        <perspective-viewer ref="viewer" class="h-80"> </perspective-viewer>

        <div class="my-8 flex justify-center gap-x-4">
          <button
            type="button"
            @click.prevent="downloadData('CSV')"
            class="btn-primary rounded duration-500"
          >
            {{ $t("message.download") }} .csv
          </button>

          <button
            type="button"
            @click.prevent="downloadData('JSON')"
            class="btn-primary rounded duration-500"
          >
            {{ $t("message.download") }} .json
          </button>
        </div>
      </div>
      <Loader v-show="isFetchingData" class="my-4 w-full h-4 flex items-center justify-center" />
    </div>
  </main>
  <AppFooter :app-version="ENV.VITE_APP_VERSION" :build-date="ENV.VITE_BUILD_DATE" />

  <div class="modal" v-show="showModal">
    <BrevoForm></BrevoForm>

    <button type="button" class="modal-btn-close" @click="toggleShowModal(false)">&#x2715;</button>
  </div>
</template>

<style computed>
.locale-changer select {
  background-color: var(--color-base);
  border: none;
}
</style>
