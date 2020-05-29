# Setup

From https://loinc.org/sars-cov-2-and-covid-19/ login and export the "SARS CoV 2 lab tests" table --> unzip.

```sh
cat Loinc_Sarscov2_Export_20200529.csv      \
  | jq --slurp  --raw-input  'split("\n")   \
  | .[0:] | map(split(","))                 \
  | map({                                   \
    "code":.[0],                            \
    "name": .[1][1:-1],                     \
    "component": .[2],                      \
    "time": .[3],                           \
    "system": .[4],                         \
    "scale": .[5],                          \
    "method": .[6]})'                       \
> Loinc_Sarscov2_Export_20200529.json
