# blastid-sdk


## Overview of the API

### Setup

```
import BlastId from 'blastid-sdk'

const blastId = new BlastId({ testnet: true })

// get the address by blast.id
blastId.name('1234.blastid').getAddress() // 0x123

// get the owner address by blast.id
blastId.name('1234.blastid').getOwner()  // 0x123

// get the blast.id by address
blastId.getName('0x111')  //xxx.blastid
```

### Test
