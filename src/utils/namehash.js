import { isEncodedLabelhash, decodeLabelhash } from './labelhash.js'
import { normalize } from 'eth-ens-namehash'
import pkg from 'js-sha3';

const {keccak_256 } = pkg;

export function namehash(inputName) {
  let node = ''
  for (let i = 0; i < 32; i++) {
    node += '00'
  }

  if (inputName) {
    const labels = inputName.split('.')

    for (let i = labels.length - 1; i >= 0; i--) {
      let labelSha
      if (isEncodedLabelhash(labels[i])) {
        labelSha = decodeLabelhash(labels[i])
      } else {
        let normalisedLabel = normalize(labels[i])
        labelSha = keccak_256(normalisedLabel)
      }
      node = keccak_256(new Buffer(node + labelSha, 'hex'))
    }
  }

  return '0x' + node
}
