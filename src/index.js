import {
  ethers
} from 'ethers'
const Provider = ethers.providers.Provider
import {
  formatsByName
} from '@ensdomains/address-encoder'
import blastIdABI from '../abis/BlastIDRegistry.json'
assert {
  type: "json"
}
import resolverABI from '../abis/PublicResolver.json'
assert {
  type: "json"
}
import reverseRegistrarABI from '../abis/ReverseRegistrar.json'
assert {
  type: "json"
}

import {
  emptyAddress,
  namehash,
  labelhash
} from './utils/index.js'


const NETWORK = {
  MAINNET: 'MAINNET',
  TESTNET: 'TESTNET'
}

const CHAIN_ID = {
  [NETWORK.MAINNET]: 'N/A',
  [NETWORK.TESTNET]: 168587773,
}

function getBlastIdAddress(network) {
  return {
    [NETWORK.TESTNET]: '0xdBF3775CDb96bb3C7fA0845238789dc7662E2932',
  } [network]
}

function getDefaultProvider(network) {
  const rpc = {
    [NETWORK.TESTNET]: 'https://sepolia.blast.io',
  } [network]
  return new ethers.providers.JsonRpcProvider(rpc)
}

function getResolverContract({
  address,
  provider
}) {
  return new ethers.Contract(address, resolverABI, provider)
}

function getBlastIdContract({
  address,
  provider
}) {
  return new ethers.Contract(address, blastIdABI, provider)
}

function getReverseRegistrarContract({
  address,
  provider
}) {
  return new ethers.Contract(address, reverseRegistrarABI, provider)
}

async function getAddrWithResolver({
  name,
  key,
  resolverAddr,
  provider
}) {
  const nh = namehash(name)
  try {
    const Resolver = getResolverContract({
      address: resolverAddr,
      provider,
    })
    const {
      coinType,
      encoder
    } = formatsByName[key]
    const addr = await Resolver['addr(bytes32,uint256)'](nh, coinType)
    if (addr === '0x') return emptyAddress

    return encoder(Buffer.from(addr.slice(2), 'hex'))
  } catch (e) {
    console.log(e)
    console.warn(
      'Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?'
    )
    return emptyAddress
  }
}

async function setAddrWithResolver({
  name,
  key,
  address,
  resolverAddr,
  signer,
}) {
  const nh = namehash(name)
  const Resolver = getResolverContract({
    address: resolverAddr,
    provider: signer,
  })
  const {
    decoder,
    coinType
  } = formatsByName[key]
  let addressAsBytes
  if (!address || address === '') {
    addressAsBytes = Buffer.from('')
  } else {
    addressAsBytes = decoder(address)
  }
  return Resolver['setAddr(bytes32,uint256,bytes)'](
    nh,
    coinType,
    addressAsBytes
  )
}

async function getTextWithResolver({
  name,
  key,
  resolverAddr,
  provider
}) {
  const nh = namehash(name)
  if (parseInt(resolverAddr, 16) === 0) {
    return ''
  }
  try {
    const Resolver = getResolverContract({
      address: resolverAddr,
      provider,
    })
    const addr = await Resolver.text(nh, key)
    return addr
  } catch (e) {
    console.warn(
      'Error getting text record on the resolver contract, are you sure the resolver address is a resolver contract?'
    )
    return ''
  }
}

async function setTextWithResolver({
  name,
  key,
  recordValue,
  resolverAddr,
  signer,
}) {
  const nh = namehash(name)
  return getResolverContract({
    address: resolverAddr,
    provider: signer,
  }).setText(nh, key, recordValue)
}

class Resolver {
  //TODO
  constructor({
    address,
    blastid
  }) {
    this.address = address
    this.blastid = blastid
  }
  name(name) {
    return new Name({
      name,
      blastid: this.blastid,
      provider: this.provider,
      signer: this.signer,
      resolver: this.address,
    })
  }
}

class Name {
  constructor(options) {
    const {
      name,
      blastid,
      provider,
      signer,
      namehash: nh,
      resolver
    } = options
    if (options.namehash) {
      this.namehash = nh
    }
    this.blastid = blastid
    this.blastIdWithSigner = this.blastid.connect(signer)
    this.name = name
    this.namehash = namehash(name)
    this.provider = provider
    this.signer = signer
    this.resolver = resolver
  }

  async getOwner() {
    return this.blastid.owner(this.namehash)
  }

  async setOwner(address) {
    if (!address) throw new Error('No newOwner address provided!')
    return this.blastIdWithSigner.setOwner(this.namehash, address)
  }

  async getResolver() {
    return this.blastid.resolver(this.namehash)
  }

  async setResolver(address) {
    if (!address) throw new Error('No resolver address provided!')
    return this.blastIdWithSigner.setResolver(this.namehash, address)
  }

  async getTTL() {
    return this.blastid.ttl(this.namehash)
  }

  async getResolverAddr() {
    if (this.resolver) {
      return this.resolver // hardcoded for old resolvers or specific resolvers
    } else {
      return this.getResolver()
    }
  }

  async getAddress(coinId) {
    const resolverAddr = await this.getResolverAddr()
    if (parseInt(resolverAddr, 16) === 0) return emptyAddress
    const Resolver = getResolverContract({
      address: resolverAddr,
      provider: this.provider,
    })
    if (!coinId) {
      return Resolver['addr(bytes32)'](this.namehash)
    }
    //TODO add coinID

    return getAddrWithResolver({
      name: this.name,
      key: coinId,
      resolverAddr,
      provider: this.provider,
    })
  }

  async setAddress(key, address) {
    if (!key) {
      throw new Error('No coinId provided')
    }

    if (!address) {
      throw new Error('No address provided')
    }
    const resolverAddr = await this.getResolverAddr()
    return setAddrWithResolver({
      name: this.name,
      key,
      address,
      resolverAddr,
      signer: this.signer,
    })
  }

  async getText(key) {
    const resolverAddr = await this.getResolverAddr()
    return getTextWithResolver({
      name: this.name,
      key,
      resolverAddr,
      provider: this.provider,
    })
  }

  async setText(key, recordValue) {
    const resolverAddr = await this.getResolverAddr()
    return setTextWithResolver({
      name: this.name,
      key,
      recordValue,
      resolverAddr,
      signer: this.signer,
    })
  }

  async setSubnodeOwner(label, newOwner) {
    const lh = labelhash(label)
    return this.blastIdWithSigner.setSubnodeOwner(this.namehash, lh, newOwner)
  }

  async setSubnodeRecord(label, newOwner, resolver, ttl = 0) {
    const lh = labelhash(label)
    return this.blastIdWithSigner.setSubnodeRecord(
      this.namehash,
      lh,
      newOwner,
      resolver,
      ttl
    )
  }

  async createSubdomain(label) {
    const resolverPromise = this.getResolver()
    const ownerPromise = this.getOwner()
    const [resolver, owner] = await Promise.all([resolverPromise, ownerPromise])
    return this.setSubnodeRecord(label, owner, resolver)
  }

  async deleteSubdomain(label) {
    return this.setSubnodeRecord(label, emptyAddress, emptyAddress)
  }
}

export default class BlastId {
  constructor(options) {
    const {
      network = NETWORK.MAINNET, provider, blastIdAddress
    } = options

    const isValidNetWork = Object.keys(NETWORK).includes(network)
    if (!isValidNetWork) {
      throw new Error('invalid network')
    }

    let ethersProvider
    if (provider) {
      if (Provider.isProvider(provider)) {
        //detect ethersProvider
        ethersProvider = provider
      } else {
        ethersProvider = new ethers.providers.Web3Provider(provider)
      }
    } else {
      ethersProvider = getDefaultProvider(network)
    }
    this.provider = ethersProvider
    this.signer = ethersProvider.getSigner()
    this.blastid = getBlastIdContract({
      address: blastIdAddress ? blastIdAddress : getBlastIdAddress(network),
      provider: ethersProvider,
    })
  }

  name(name) {
    return new Name({
      name,
      blastid: this.blastid,
      provider: this.provider,
      signer: this.signer,
    })
  }

  resolver(address) {
    return new Resolver({
      blastid: this.blastid,
      provider: this.provider,
      address: address,
    })
  }

  async getName(address) {
    const reverseNode = `${address.slice(2)}.addr.reverse`
    const resolverAddr = await this.blastid.resolver(namehash(reverseNode))
    return this.getNameWithResolver(address, resolverAddr)
  }

  async getNameWithResolver(address, resolverAddr) {
    const reverseNode = `${address.slice(2)}.addr.reverse`
    const reverseNamehash = namehash(reverseNode)
    if (parseInt(resolverAddr, 16) === 0) {
      return {
        name: null,
      }
    }

    try {
      const Resolver = getResolverContract({
        address: resolverAddr,
        provider: this.provider,
      })
      const name = await Resolver.name(reverseNamehash)
      return name
    } catch (e) {
      console.log(`Error getting name for reverse record of ${address}`, e)
    }
  }

  
  async setReverseRecord(name, overrides) {
    const reverseRegistrarAddr = await this.name('addr.reverse').getOwner(
      'addr.reverse'
    )
    const reverseRegistrar = getReverseRegistrarContract({
      address: reverseRegistrarAddr,
      provider: this.signer,
    })
    return reverseRegistrar.setName(name)
  }
}

export {
  namehash,
  labelhash,
  getBlastIdContract,
  getResolverContract,
  getBlastIdAddress,
  NETWORK,
}