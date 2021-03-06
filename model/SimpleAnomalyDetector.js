var utilClass = require('./anomaly_detection_util');

/// class SimpleAnomalyDetector
class SimpleAnomalyDetector {
    constructor() {
        this.cf = []
        this.correlationThresholdLine = 0.9;
    }

    /// returns the max deviation between the two features in the struct.
    getMaxDev(x, y, l, numOfLines) {
        let cfMaxDev = 0;
        let i;
        for (i = 0; i < numOfLines; i++) {
            let p = new utilClass.Point(x[i], y[i]);
            let tempDev = utilClass.dev(p, l);
            if (tempDev > cfMaxDev) { /// check if it is the biggest deviation until now
                cfMaxDev = tempDev; /// update if it is
            }
        }
        return cfMaxDev;
    }

    /// checks if the correlation is higher enough for create a struct and returns true if it does.
    isCorrelatedEnough(correlation) {
        return Math.abs(correlation) > this.correlationThresholdLine;
    }

    /// the function completes updating the struct -the line and the threshold.
    completeStruct(cfStruct, f1, f2, matrix, size) {
        cfStruct.lin_reg = utilClass.linear_reg(matrix[f1], matrix[f2], size);
        cfStruct.threshold = this.getMaxDev(matrix[f1], matrix[f2], cfStruct.lin_reg, size) * 1.1;
    }

    /// the function creates the "struct" and pushes it to the cfTemp list.
    makeStruct(ts, f1, f2, maxPearson, cfTemp) {
        let matrix = ts.getMapMatrix();
        let correlatedFeatures = { feature1: f1, feature2: f2, correlation: maxPearson, lin_reg: "", threshold: 0 };
        this.completeStruct(correlatedFeatures, f1, f2, matrix, ts.getNumOfData());
        cfTemp.push(correlatedFeatures)
    }

    /// this is the offline learning level - learning from proper flight data the correlative features and their linear
    /// regression line, their pearson and calculate their threshold.
    learnNormal(ts) {
        let cfTemp = []
        let matrix = ts.getMapMatrix();
        let feature1;
        let feature2 = "";
        let numOfFeatures = ts.getNumOfFeatures();
        let numOfLines = ts.getNumOfData();
        for (let i = 0; i < numOfFeatures; i++) {
            let maxPearson = 0;
            feature1 = ts.getFeatureNames()[i];
            for (let j = i + 1; j < numOfFeatures; j++) {
                let tempFeature = ts.getFeatureNames()[j]; /// temp feature name - maybe will be feature2
                let tempPearson = utilClass.pearson(matrix[feature1], matrix[tempFeature], numOfLines);

                if (Math.abs(tempPearson) > Math.abs(maxPearson)) { /// if it's the biggest pearson (in absolute value) until now
                    maxPearson = tempPearson; /// update if it is
                    feature2 = tempFeature; /// update also that it will be feature2
                }
            }
            if(this.isCorrelatedEnough(maxPearson) === true) { /// make the struct only if the correlation between the two features is higher enough
                this.makeStruct(ts, feature1, feature2, maxPearson, cfTemp);
            }
        }
        this.cf = cfTemp
    }

    /// the function returns true if there is an anomaly in this line (if the deviation is too high). false otherwise.
    isAnomaly(ts, cfStruct, indexLine) {
        let matrix = ts.getMapMatrix();
        let p = new utilClass.Point(matrix[cfStruct.feature1][indexLine], matrix[cfStruct.feature2][indexLine]);
        let tempDev = utilClass.dev(p, cfStruct.lin_reg); /// check the deviation in the line
        return tempDev > cfStruct.threshold;
    }
    
    /// this is the online anomaly detection level - reading the live flight data line by line and if we found a deviation
    /// we will report about it with the details of the deviation.
    detect(ts) {
        let arVec = []; // the AnomalyReport list we will return
        let numOfLines = ts.getNumOfData();
        for (let cfStruct in this.cf) {
            for(let i = 0; i < numOfLines; i++) {
                if(this.isAnomaly(ts, this.cf[cfStruct], i)) {
                    let AnomalyReport = {description: this.cf[cfStruct].feature1 + "\n" + this.cf[cfStruct].feature2, timeStep: i+1}
                    arVec.push(AnomalyReport)
                }
            }
        }
        return arVec;
    }

    /// returns the cf list.
    getNormalModel() {
        return this.cf;
    }
}

module.exports.learnNormal = this.learnNormal
module.exports.detect = this.detect
module.exports.getNormalModel = this.getNormalModel
module.exports = { SimpleAnomalyDetector };