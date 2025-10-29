newman run "Corporate_batch_one.postman_collection.json" \
 -e "Corporate Dev Copy.postman_environment.json" \
 --reporters cli,htmlextra \
 --reporter-htmlextra-export ./report.html \
 --delay-request 2000 \

> output.txt
