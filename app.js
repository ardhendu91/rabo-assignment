const fs = require('fs');
const xml2js = require('xml2js');
const xmlParser = new xml2js.Parser();
const csvParser = require('csv-parser');

//Function to read data from XML file
function readXML(){
    return new Promise((resolve,reject) => {
        fs.readFile('./InputFiles/records.xml', function(err, data) {
            xmlParser.parseString(data, function (err, result) {
                if(err){
                    reject(err);
                }else{
                    resolve(result.records.record);
                }
            });
        });
    })
}

//Function to read data from CSV file
function readCSV(){
    return new Promise((resolve,reject) => {
        const records = [];
        fs.createReadStream('./InputFiles/records.csv')
            .pipe(csvParser())
            .on('data', (data) => records.push(data))
            .on('end', () => resolve(records))
    })
}

//Function to format the XML Data
function convertXMLData(xmlData){
    return xmlData.map((record) => {
        const convertedRecord = {
            Reference: record["$"].reference,
            "Account Number": record.accountNumber[0],
            Description: record.description[0],
            "Start Balance": record.startBalance[0],
            Mutation: record.mutation[0],
            "End Balance": record.endBalance[0],
        };
        return convertedRecord;
    });
}

//Function to write the report file
function createOutputReport(filename, data){
    const writeStream = fs.createWriteStream(filename);
    writeStream.write('Reference Number,Description,Remarks\n');
    data.forEach((entry) => {
        writeStream.write(`${entry[0]},${entry[1]},${entry[2]}\n`);
    });
    writeStream.end();
    console.log('Output file created successfully:', filename);
}

(async () => {
    try {
        let combinedData = [];
        fs.readdir('./InputFiles',async (error, files) =>{
            if(error){
                console.error('Error reading folder! ',error)
            }else{
                const promises = files.map(async (file) => {            //Creating a promise array to read contents of all input files
                    if (file.includes('.csv')) {
                        return await readCSV();
                    } else if (file.includes('.xml')) {
                        const xmlDataTemp = await readXML();
                        return await convertXMLData(xmlDataTemp);
                    }
                });
                combinedData.push(...(await Promise.all(promises)));        
                combinedData = combinedData.reduce((result, currentArray) => result.concat(currentArray), []);  // Creating a single array from output of all files
                let duplicateReferences = {};
                const endBalanceMismatch = [];
                combinedData.forEach(item => {
                    if (duplicateReferences[item.Reference]) {
                        duplicateReferences[item.Reference].push(item.Description);
                    } 
                    else {
                        duplicateReferences[item.Reference] = [item.Description];
                    }

                    const startBalance = parseFloat(item['Start Balance']);
                    const mutation = parseFloat(item.Mutation);
                    const endBalance = parseFloat(item['End Balance']);

                    if (parseFloat((startBalance + mutation).toFixed(2)) !== endBalance) {
                        endBalanceMismatch.push({
                        Reference: item.Reference,
                        Description: item.Description
                        });
                    }
                });  
                duplicateReferences = Object.entries(duplicateReferences).filter(
                    ([reference, descriptions]) => descriptions.length > 1
                );
                const allData = [
                    ...duplicateReferences.flatMap(([referenceNumber, descriptions]) =>
                      descriptions.map((description) => [referenceNumber, description, 'Duplicate'])
                    ),
                    ...endBalanceMismatch.map((entry) => [entry.Reference, entry.Description, 'End Balance Mismatch']),
                ];  
                createOutputReport('./OutputFiles/report.csv', allData);
            }
        })
    } catch (error) {
      console.error('Error:', error);
    }
  })();