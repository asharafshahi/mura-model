const http = require('http');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const dicom = require('dicom-parser/dist/dicomParser');
const aiMktApi = require('@nuance/ai-marketplace-api');
require('dotenv').load();

const imageRootDir = process.env.IMAGE_ROOT_DIR;
const serviceKey = process.env.SERVICE_KEY;
const hostname = '0.0.0.0';
const port = 3001;
const modelEndpoint = 'http://127.0.0.1:8001/score/?file=';
const aiTransactions = new aiMktApi(process.env.AI_TRANSACTIONS_ENDPOINT, 
                                    process.env.AI_TRANSACTIONS_KEY)

const server = http
  .createServer((req, res) => {
    console.log(`\n${req.method} ${req.url}`);
    console.log(req.headers);
    let body = [];
    req
      .on('data', chunk => {
        body.push(chunk);
      })
      .on('end', async () => {
        body = Buffer.concat(body).toString();
        const { transactionId, uris } = JSON.parse(body);
        let studyFolder, studyUid, imageUid;
        await Promise.all(
          uris.map(async url => {
            try {
              const result = await axios.get(url, {
                responseType: 'arraybuffer'
              });
              ({ studyUid, imageUid } = getUids(result.data));
              studyFolder = `${imageRootDir}/${studyUid}`;
              const outputFilename = `${imageRootDir}/${studyUid}/${imageUid}.dcm`;
              fs.ensureDirSync(studyFolder);
              fs.writeFileSync(outputFilename, result.data);
              console.log(`Wrote file ${outputFilename}`);
            } catch (err) {
              console.error(err);
            }
          })
        );
        const preProcessDir = `${imageRootDir}/preprocess/${studyUid}`;
        await preProcessToPng(studyFolder, preProcessDir);
        const result = await runModel(preProcessDir);
        console.log(`AI model returned: ${result[0].data}`);
        const postProcessedData = postProcessToJson(result);
        const resultId = await aiTransactions.createResult(transactionId, serviceKey, 'test');
        await aiTransactions.uploadResultData(transactionId, resultId, postProcessedData);
      });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Acknowledged\n');
  })
  .listen(port, hostname, () => {
    console.log(`Server running at http://localhost:${port}/`);
  });

const getUids = dicomData => {
  const dataSet = dicom.parseDicom(dicomData);
  const studyUid = dataSet.string('x0020000d');
  const imageUid = dataSet.string('x00080018');
  return { studyUid, imageUid };
};

// This function will be customized/replaced for each model based on needs
const preProcessToPng = async (sourceDir, destDir) => {
  const fileList = fs.readdirSync(sourceDir);
  fs.ensureDirSync(destDir);
  await Promise.all(
    fileList.map(file =>
      exec(`gdcm2vtk ${sourceDir + '/' + file} ${destDir}/${file.substr(0, file.length - 4)}.png`)
    )
  );
  return;
};

const runModel = async directory => {
  const fileList = fs.readdirSync(directory);
  return await Promise.all(
    fileList.map(file => {
      const url = `${modelEndpoint}${directory + '/' + file}`;
      console.log(url);
      return axios.get(url);
    })
  );
};

// This function will be customized/replaced for each model based on needs
const postProcessToJson = allResults =>
  JSON.stringify(
    allResults.reduce(
      (acc, curr) => {
        acc.findings.push(curr.data);
        return acc;
      },
      { findings: [] }
    )
  );
