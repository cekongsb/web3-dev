const Trie = require('merkle-patricia-tree');
const levelup = require('levelup');
const HDWalletProvider = require('truffle-hdwallet-provider');
const Web3 = require('web3');
const async = require('async')
const rlp = require('rlp');
const EthereumTx = require('ethereumjs-tx')
const EthereumBlock = require('ethereumjs-block/from-rpc')
const { reject } = require('any-promise');
const mnemonic = "loan ring slab add shine eternal eternal weird market holiday piano goddess";

let provider = new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/v3/6d014b1c22c6418fbe11e78e3097fe1b");

const web3 = new Web3(provider);
// console.log(web3.eth.accounts)

// web3.eth.getTransaction('0xef24ecb89c32c9f892e9464d168f82a1eb9a3531365553489c4289a2ab5498d0')
// .then(console.log);

const txHash = "0xaafa83433918500a419d6fa7f66dcae50ecb5d424e5b671bc314d739d17eeae7";

web3.eth.getTransaction(txHash, function(e,transaction) {
    if(e || !transaction) { console.log("transaction not found")}
    web3.eth.getBlock(transaction.blockHash, true, function(e, block) {
        if(e || !block) {   console.log("block not found")  }
        var txTrie = new Trie(); 
        b = block; 
        async.map(block.transactions, function(siblingTx, cb2) {
            var path = rlp.encode(siblingTx.transactionIndex)
            var rawSignedSiblingTx = new EthereumTx(squanchTx(siblingTx)).serialize()
            txTrie.put(path, rawSignedSiblingTx, function (error) {
                if(error != null) { cb2(error, null); } else { cb2(null, true) }
            })
        }, function(e, r){
            txTrie.findPath(rlp.encode(transaction.transactionIndex), function(e, rawTxNode, remainder, stack) {              
                let blockHash = Buffer.from(transaction.blockHash.slice(2), 'hex');
                let blockNumber = block.number;
                let header = getRawHeader(block);
                let parentNodes = rawStack(stack);
                let path = rlp.encode(transaction.transactionIndex);
                let value = rlp.decode(rawTxNode.value);
                
                let tx_hex = rlp.encode(value).toString('hex');
                let tx_root_hex = rlp.encode(header[4]).toString('hex');
                let txmerkleproof_hex = rlp.encode(parentNodes).toString('hex');
                let txmerkleproofpath_hex = path.toString('hex');
                

                console.log("tx_hex=", tx_hex);
                console.log("tx_root_hex=", tx_root_hex);
                console.log("txmerkleproof_hex=", txmerkleproof_hex);
                console.log("txmerkleproofpath_hex=", txmerkleproofpath_hex);
                console.log("blockNumber=", blockNumber);
            })
        })
    })
})

web3.eth.getTransactionReceipt(txHash, function(e, receipt) {
    if (e || !receipt) { console.log("receipt not found")}
    web3.eth.getBlock(receipt.blockHash, false, function(e, block) {
        if (e || !block) { console.log("block not found") }
        var receiptsTrie = new Trie();
        async.map(block.transactions, function(siblingTxHash, cb2) {
            web3.eth.getTransactionReceipt(siblingTxHash, function(e, siblingReceipt){
                if(!e && siblingReceipt){
                    putReceipt(siblingReceipt, receiptsTrie, block.number, cb2)
                } else {
                    web3.eth.getTransactionReceipt(siblingTxHash, function(e, siblingReceipt) {
                        if (!e &&siblingReceipt) {
                            putReceipt(siblingReceipt, receiptsTrie, block.number, cb2)
                        } else {
                            web3.eth.getTransactionReceipt(siblingTxHash, function(e, siblingReceipt) {
                                if (!e && siblingReceipt) {
                                    putReceipt(siblingReceipt, receiptsTrie, block.number, cb2)
                                }
                            });
                        }
                    });
                }
            })
        }, function(e, r) {
            receiptsTrie.findPath(rlp.encode(receipt.transactionIndex), function(e, rawReceiptNode, remainder, stack) {
                let blockHash = Buffer.from(receipt.blockHash.slice(2), 'hex');
                let header = getRawHeader(block);
                let parentNodes = rawStack(stack);
                let path = rlp.encode(receipt.transactionIndex);
                let value = rlp.decode(rawReceiptNode.value);

                let receipt_hex = rlp.encode(value).toString('hex');
                let receipt_root_hex = rlp.encode(header[5]).toString('hex');
                let receiptmerkleproof_hex = rlp.encode(parentNodes).toString('hex');

                console.log("receipt_root_hex=", receipt_root_hex);
                console.log("receipt_hex=", receipt_hex);
                console.log("receiptmerkleproof_hex=", receiptmerkleproof_hex);
            })
        });
    })
})

var putReceipt = (siblingReceipt, receiptsTrie, blockNum, cb2) => {//need siblings to rebuild trie
    var path = siblingReceipt.transactionIndex

    var cummulativeGas = numToBuf(siblingReceipt.cumulativeGasUsed)
    var bloomFilter = strToBuf(siblingReceipt.logsBloom)
    var setOfLogs = encodeLogs(siblingReceipt.logs)
    if(siblingReceipt.status != undefined && siblingReceipt.status != null){
        // var status = strToBuf(siblingReceipt.status)
        // This is to fix the edge case for passing integers as defined - https://github.com/ethereum/wiki/wiki/RLP
        // if (status.toString('hex') == 1)
        if (siblingReceipt.status == true) {
            var rawReceipt = rlp.encode([1,cummulativeGas,bloomFilter,setOfLogs])
        } else {
            var rawReceipt = rlp.encode([0,cummulativeGas,bloomFilter,setOfLogs])
        }
    } else {
        var postTransactionState = strToBuf(siblingReceipt.root)
        var rawReceipt = rlp.encode([postTransactionState,cummulativeGas,bloomFilter,setOfLogs])
    }
    receiptsTrie.put(rlp.encode(path), rawReceipt, function (error) {
      error != null ? cb2(error, null) : cb2(error, true)
    })
}

var rawStack = (input) => {
    output = []
    for (var i = 0; i < input.length; i++) {
        output.push(input[i].raw)
    }
    return output
}

var squanchTx = (tx) => {
    tx.gasPrice = '0x' + tx.gasPrice.toString(16)
    tx.value = '0x' + tx.value.toString(16)
    return tx;
}

var getRawHeader = (_block) => {
    if(typeof _block.difficulty != 'string'){
        _block.difficulty = '0x' + _block.difficulty.toString(16)
    }
    var block = new EthereumBlock(_block)
    return block.header.raw
}

var encodeLogs = (input) => {
    var logs = []
    for (var i = 0; i < input.length; i++) {
      var address = strToBuf(input[i].address);
      var topics = input[i].topics.map(strToBuf)
      var data = Buffer.from(input[i].data.slice(2),'hex')
      logs.push([address, topics, data])
    }
    return logs
}

var strToBuf = (input)=>{ 
    if(input.slice(0,2) == "0x"){   
        return Buffer.from(byteable(input.slice(2)), "hex")
    } else {
        return Buffer.from(byteable(input), "hex") 
    }
}

var numToBuf = (input)=>{ return Buffer.from(byteable(input.toString(16)), "hex") }
var byteable = (input)=>{ return input.length % 2 == 0 ? input : "0" + input }
provider.engine.stop();

