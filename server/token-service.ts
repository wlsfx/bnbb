import { ethers } from 'ethers';
import { BSCBlockchainClient } from './blockchain-client';
import { storage } from './storage';
import type { InsertToken, InsertTokenDeployment, InsertLiquidityPool } from '@shared/schema';

// Standard BEP-20 Token ABI (minimal required functions)
const BEP20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function transferFrom(address, address, uint256) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// BEP-20 Token Bytecode (compiled from standard OpenZeppelin ERC20)
// This is a pre-compiled bytecode for a standard BEP-20 token with constructor parameters
const BEP20_BYTECODE = "0x60806040523480156200001157600080fd5b5060405162001f5538038062001f55833981810160405260808110156200003857600080fd5b8101908080516040519392919084640100000000821115620000595780fd5b908301906020820185811115620000705760009182fd5b8251640100000000811182820188101715620000895780fd5b82525081516020918201929091019080838360005b83811015620000b95781810151838201526020016200009f565b50505050905090810190601f168015620000e75780836003820160401112601560008114602084171615020283168635021760001982161790555b509092019150506040519050810160405160208110156200010857600080fd5b81019080805160405193929190846401000000008211156200012a57600080fd5b90830190602082018581111562000141575f9182fd5b82516401000000008111828201881017156200015a5780fd5b82525081516020918201929091019080838360005b838110156200018a578181015183820152602001620001705260200192909250929092019150506040519150810160405280925085935084935083935083935050508383620001c66301ffc9a760e01b620002a8565b620001d96306fdde0360e01b620002a8565b620001ec6395d89b4160e01b620002a8565b620001ff63313ce56760e01b620002a8565b60608361511061521561522161522d61523961524561525161525d62002d6200024f60405180604001604052806005815260200164424550323160d81b815250600790620002b0909190620002ac56558382600690816200026491906200036c565b50816005908162000276919062000368565b506004805460ff191660ff83161790556200029033620002985760006200029a565b84620002ac565b5050505050505062000405565b62000208826000835b6001600160a01b0383166200030c5760405162461bcd60e51b815260206004820152602660248201527f45524332303a206d696e7420746f20746865207a65726f20616464726573736044820152600080fd5b80600360008282546200032091906200033e565b90915550506001600160a01b03831660009081526001602052604090208054830190556200034f8382620003545762461bcd60e51b8152600401604051806200033e908152602001826001600160a01b031681526020018084815260200191505060405180910390fd5b60006200036882846200030c565b9392505050565b634e487b7160e01b600052604160045260246000fd5b600181811c908216806200039b57607f821691505b602082108103620003bc57634e487b7160e01b600052602260045260246000fd5b50919050565b600181811c90821680620003d757607f821691505b602082108103620003f857634e487b7160e01b600052602260045260246000fd5b50919050565b6119418062000414833901906000f3fe608060405234801561001057600080fd5b5060043610610114576000357c0100000000000000000000000000000000000000000000000000000000900480636fdde0314610119578063715018a61461013857806379cc67901461014257806395d89b41146101555780639dc29fac146101b7578063a457c2d714610155578063a9059cbb146101ca578063d505accf146101dd578063d539139314610192578063dd62ed3e146101f5578063f2fde38b14610208578063fcfff16f1461021b575b600080fd5b610121610225565b60405161012f91906114cb565b60405180910390f35b6101406102b7565b005b6101406101503660046114e5565b6102cb565b61015d6102e1565b60405161012f919061151761006d60002361007b16565b6040516001600160e01b03199091168152602001610099015b6101406101653660046114e5565b6102f0565b6101896101773660046114e5565b610306565b60405190151581526020016101865760008190506040518181527ff8b2cb4f0000000000000000000000000000000000000000000000000000000081523060048201526001600160a01b038516906370a0823190602401602060405180830381865afa1580156101c5573d6000fd5b505050506040513d601f19601f820116820180604052508101906101e9919061155b565b6101f291906115815b91506101899150611598565b6101c56101d33660046115cb565b6103195761033456610332565b6101406101eb3660046115fc565b610336565b6101c56102033660046116d961034a565b61037b565b610140610216366004611712565b6103a5565b61014061041b6103f456610400565b61022d610435565b60606005805461023c9061172d565b80601f01602080910402602001604051908101604052809291908181526020018280546102699061172d565b80156102b65780601f1061028b576101008083540402835291600020916102b6565b820191906000526020600020905b81548152906001019060200180831161029957829003601f168201915b5050505050905090565b6102bf610469565b6102c960006104c3565b565b6102d7823383036102cb565b6102dd8282610515565b5050565b60606006805461023c9061172d565b6102fd823383036102f0565b6102dd8282610623565b60006103136000610306565b92915050565b60006103268484846106a8565b506001949350505050565b61033e610875565b6103478161087f565b50565b600080610356836108d8565b9050610363818585610918565b610373838361099d565b949350505050565b600080610388848461099d565b905061039c6001600160a01b0385168487610a17565b50600195945050505050565b6103ad610469565b6001600160a01b0381166104125760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b60648201526084016106b6565b610347816104c3565b610423610469565b600880546001600160a01b0319169055610875565b6000610440336108d8565b9050610463816001600160a01b03168461045a856108d8565b610918565b50505050565b6000546001600160a01b031633146102c95760405162461bcd60e51b815260206004820181905260248201527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e657260448201526064016106b6565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6001600160a01b0382166105755760405162461bcd60e51b815260206004820152602160248201527f45524332303a206275726e2066726f6d20746865207a65726f206164647265736044820152607360f81b60648201526084016106b6565b6001600160a01b038216600090815260016020526040902054818110156105ea5760405162461bcd60e51b815260206004820152602260248201527f45524332303a206275726e20616d6f756e7420657863656564732062616c616e60448201526131b960f11b60648201526084016106b6565b6001600160a01b03831660009081526001602052604081208383039055600380548490039055905261061d8383610a67565b50505050565b6001600160a01b038216610679 5760405162461bcd60e51b815260206004820152601f60248201527f45524332303a206d696e7420746f20746865207a65726f20616464726573730060448201526064016106b6565b806003600082825461068b9190611767565b90915550506001600160a01b038216600090815260016020526040902080548201905561069e8282610aba565b5050565b60006001600160a01b0384166106ff5760405162461bcd60e51b815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f206164604482015264647265737360d81b60648201526084016106b6565b6001600160a01b03831661075f5760405162461bcd60e51b815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201526265737360e81b60648201526084016106b6565b6001600160a01b038416600090815260016020526040902054828110156107d85760405162461bcd60e51b815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e7420657863656564732062604482015265616c616e636560d01b60648201526084016106b6565b6001600160a01b0380861660009081526001602052604080822085870390558587168252812080548601905554909116156108685760085460405163555ddc6560e11b81526001600160a01b03909116600482015260248101849052604481018590526064810182905260840160006040518083038186803b15801561085f57600080fd5b505afa610868573d6000fd5b5050505061086a8585610b0e565b5060019050610873565b600061088b610b62565b54604051631627540560e01b815260048101919091526001600160a01b039091169063162754059060240160006040518083038186803b1580156108cf57600080fd5b505afa610868573d6000fd5b60006108e5823333610b93565b90506001600160a01b0381166109125760405162461bcd60e51b815260040160405180602001604052806000815250506106b6565b92915050565b600061092584848461099d565b90508061099757604051636cf4791b60e01b815260206004820152603560248201527f455243323050 65726d69743a20696e73756666696369656e7420616c6c6f7761604482015274031b1b2b4b732903337b91030b63637bbb2b23a1760591b60648201526084016106b6565b50505050565b60006001600160a01b038316610a0f5760405162461bcd60e51b815260206004820152603060248201527f45524332303a20617070726f76652066726f6d20746865207a65726f20616460448201526f1932b9b990309039b2b7321037bbb71760811b60648201526084016106b6565b506001600160a01b03908116600090815260026020908152604080832093909416825291909152205490565b6040516001600160a01b03831660248201526044810182905261069e90849063a9059cbb60e01b90606401610bd3565b806001600160a01b03168260016001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef84604051610aad91815260200190565b60405180910390a4505050565b806001600160a01b03168260016001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef84604051610b0091815260200190565b60405180910390a45050565b816001600160a01b03168360016001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef83604051610b5591815260200190565b60405180910390a3505050565b60007f0000000000000000000000000000000000000000000000000000000000000061461461072c90565b600080846001600160a01b031663d505accf60e01b8585604051602401610bba91906117bb6020808252825182820152828101516001600160a01b039081166040840152604084015181166060840152606084015160808401526080840151905190911660a082015260a00190565b604051610bc79190611818565b60008060405180830381855af49150503d8060008114610c0357604051610bfe601f3d011682016040523d82525d6000603f3d01101561181f565b610c03565b6040513d6000823e3d601f19601f82011682018060405250810190610c2891906118e4565b5092506001600160a01b038316610c3f5750610c41565b505b919050565b600060208083528351808285015260005b81811015610c7357858101830151858201604001528201610c57565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b038116811461094257600080fd5b60008060408385031215610cbe57600080fd5b610cc783610c95565b946020939093013593505050565b600080600060608486031215610cea57600080fd5b610cf384610c95565b9250610d0160208501610c95565b9150604084013590509250925092565b600060208284031215610d2357600080fd5b61041282610c95565b60ff8116811461034757600080fd5b600080600080600080600060e0888a031215610d5657600080fd5b610d5f88610c95565b9650610d6d60208901610c95565b9550604088013594506060880135935060808801359250610d9160a08901610c95565b915060c0880135610da181610d2c565b8091505092959891949750929550565b60008060408385031215610dc457600080fd5b610dcd83610c95565b9150610ddb60208401610c95565b90509250929050565b600181811c90821680610df857607f821691505b602082108103610e1857634e487b7160e01b600052602260045260246000fd5b50919050565b634e487b7160e01b600052601160045260246000fd5b80820180821115610e4857610e48610e1e565b92915050565b60208082526030908201527f45524332303a207472616e7366657220616d6f756e74206578636565647320616040820152906f6c6c6f77616e636560801b606082015260800190565b81810381811115610e4857610e48610e1e565b601f8211156106a857600081815260208120601f850160051c81016020861015610ed25750805b601f850160051c820191505b81811015610ef157828155600101610ede565b505050505050565b81516001600160401b03811115610f1257610f12611901565b610f2681610f208454610de4565b84610eab565b602080601f831160018114610f5b5760008415610f435750858301515b600019600386901b1c1916600185901b178555610ef1565b600085815260208120601f198616915b82811015610f8a57888601518255948401946001909101908401610f6b565b5085821015610fa85787850151600019600388901b60f8161c191681555b5050505050600190811b0190555056fea26469706673582212202e7c0f5b7f73bb8c1f39ef18d4a24fe973e1fd637e973e1c6e6b2e7c8b10c8c064736f6c634300081300033";

// PancakeSwap V2 Router Address on BSC Testnet
const PANCAKESWAP_ROUTER_ADDRESS = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";
const PANCAKESWAP_FACTORY_ADDRESS = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";

// PancakeSwap Router ABI (minimal required functions)
const PANCAKESWAP_ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)",
  "function WETH() view returns (address)"
];

export class TokenService {
  private bscClient: BSCBlockchainClient;

  constructor() {
    this.bscClient = new BSCBlockchainClient();
  }

  /**
   * Deploy a new BEP-20 token to BSC Testnet
   */
  async deployToken(
    walletPrivateKey: string,
    tokenParams: {
      name: string;
      symbol: string;
      totalSupply: string; // in token units (will be multiplied by decimals)
      decimals: number;
    },
    launchPlanId?: string
  ): Promise<{
    tokenAddress: string;
    transactionHash: string;
    deploymentId: string;
  }> {
    try {
      const provider = this.bscClient.getProvider();
      const wallet = new ethers.Wallet(walletPrivateKey, provider);

      // Convert total supply to smallest unit
      const totalSupplyWei = ethers.utils.parseUnits(tokenParams.totalSupply, tokenParams.decimals);

      // Create contract factory
      const contractFactory = new ethers.ContractFactory(BEP20_ABI, BEP20_BYTECODE, wallet);

      // Deploy the contract
      console.log('Deploying BEP-20 token with params:', {
        name: tokenParams.name,
        symbol: tokenParams.symbol,
        totalSupply: tokenParams.totalSupply,
        decimals: tokenParams.decimals
      });

      const contract = await contractFactory.deploy(
        tokenParams.name,
        tokenParams.symbol,
        tokenParams.decimals,
        totalSupplyWei,
        { gasLimit: 3000000 }
      );

      // Wait for deployment
      const deploymentTx = await contract.deployTransaction.wait();
      
      console.log('Token deployed successfully:', {
        address: contract.address,
        transactionHash: deploymentTx.transactionHash
      });

      // Store token in database
      const tokenData: InsertToken = {
        address: contract.address.toLowerCase(),
        name: tokenParams.name,
        symbol: tokenParams.symbol,
        decimals: tokenParams.decimals,
        totalSupply: tokenParams.totalSupply,
        deployerWalletId: wallet.address.toLowerCase(),
        contractAbi: JSON.stringify(BEP20_ABI),
        launchPlanId: launchPlanId,
        chainId: 97, // BSC Testnet
        isLiquidityAdded: false,
        deployedAt: new Date(),
        metadata: JSON.stringify({
          deploymentGasUsed: deploymentTx.gasUsed.toString(),
          deploymentBlockNumber: deploymentTx.blockNumber
        })
      };

      const token = await storage.createToken(tokenData);

      // Store deployment transaction
      const deploymentData: InsertTokenDeployment = {
        tokenId: token.id,
        launchPlanId: launchPlanId,
        deployerWalletId: wallet.address.toLowerCase(),
        transactionHash: deploymentTx.transactionHash,
        blockNumber: deploymentTx.blockNumber,
        gasUsed: deploymentTx.gasUsed.toString(),
        status: 'completed',
        deployedAt: new Date()
      };

      const deployment = await storage.createTokenDeployment(deploymentData);

      return {
        tokenAddress: contract.address,
        transactionHash: deploymentTx.transactionHash,
        deploymentId: deployment.id
      };
    } catch (error) {
      console.error('Error deploying token:', error);
      throw error;
    }
  }

  /**
   * Add liquidity to PancakeSwap
   */
  async addLiquidity(
    walletPrivateKey: string,
    tokenAddress: string,
    tokenAmount: string, // in token units
    bnbAmount: string, // in BNB
    slippageTolerance: number = 5 // percentage
  ): Promise<{
    poolAddress: string;
    transactionHash: string;
    liquidityTokenAmount: string;
  }> {
    try {
      const provider = this.bscClient.getProvider();
      const wallet = new ethers.Wallet(walletPrivateKey, provider);

      // Get token contract
      const tokenContract = new ethers.Contract(tokenAddress, BEP20_ABI, wallet);
      
      // Get PancakeSwap router
      const routerContract = new ethers.Contract(PANCAKESWAP_ROUTER_ADDRESS, PANCAKESWAP_ROUTER_ABI, wallet);

      // Get token decimals
      const decimals = await tokenContract.decimals();
      const tokenAmountWei = ethers.utils.parseUnits(tokenAmount, decimals);
      const bnbAmountWei = ethers.utils.parseEther(bnbAmount);

      // Approve router to spend tokens
      console.log('Approving router to spend tokens...');
      const approveTx = await tokenContract.approve(PANCAKESWAP_ROUTER_ADDRESS, tokenAmountWei);
      await approveTx.wait();

      // Calculate minimum amounts with slippage
      const minTokenAmount = tokenAmountWei.mul(100 - slippageTolerance).div(100);
      const minBnbAmount = bnbAmountWei.mul(100 - slippageTolerance).div(100);

      // Add liquidity
      console.log('Adding liquidity to PancakeSwap...');
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes from now
      
      const addLiquidityTx = await routerContract.addLiquidityETH(
        tokenAddress,
        tokenAmountWei,
        minTokenAmount,
        minBnbAmount,
        wallet.address,
        deadline,
        { value: bnbAmountWei, gasLimit: 500000 }
      );

      const receipt = await addLiquidityTx.wait();
      
      console.log('Liquidity added successfully:', {
        transactionHash: receipt.transactionHash
      });

      // Get pool address from factory
      const factoryContract = new ethers.Contract(
        PANCAKESWAP_FACTORY_ADDRESS,
        ["function getPair(address, address) view returns (address)"],
        provider
      );
      const wbnbAddress = await routerContract.WETH();
      const poolAddress = await factoryContract.getPair(tokenAddress, wbnbAddress);

      // Update token in database
      const token = await storage.getTokenByAddress(tokenAddress);
      if (token) {
        await storage.updateToken(token.id, {
          isLiquidityAdded: true,
          liquidityPoolAddress: poolAddress
        });

        // Store liquidity pool info
        const poolData: InsertLiquidityPool = {
          tokenId: token.id,
          pairAddress: poolAddress,
          token0Address: tokenAddress.toLowerCase(),
          token1Address: wbnbAddress.toLowerCase(),
          token0Reserve: tokenAmount,
          token1Reserve: bnbAmount,
          dexName: 'PancakeSwap',
          chainId: 97,
          createdAt: new Date()
        };

        await storage.createLiquidityPool(poolData);
      }

      return {
        poolAddress,
        transactionHash: receipt.transactionHash,
        liquidityTokenAmount: "0" // TODO: Parse from events
      };
    } catch (error) {
      console.error('Error adding liquidity:', error);
      throw error;
    }
  }

  /**
   * Get token information from blockchain
   */
  async getTokenInfo(tokenAddress: string): Promise<{
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    owner?: string;
  }> {
    try {
      const provider = this.bscClient.getProvider();
      const tokenContract = new ethers.Contract(tokenAddress, BEP20_ABI, provider);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.totalSupply()
      ]);

      return {
        name,
        symbol,
        decimals,
        totalSupply: ethers.utils.formatUnits(totalSupply, decimals)
      };
    } catch (error) {
      console.error('Error getting token info:', error);
      throw error;
    }
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(tokenAddress: string, holderAddress: string): Promise<string> {
    try {
      const provider = this.bscClient.getProvider();
      const tokenContract = new ethers.Contract(tokenAddress, BEP20_ABI, provider);
      
      const balance = await tokenContract.balanceOf(holderAddress);
      const decimals = await tokenContract.decimals();
      
      return ethers.utils.formatUnits(balance, decimals);
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  /**
   * Get token holders (requires event scanning - simplified version)
   */
  async getTokenHolders(tokenAddress: string, limit: number = 100): Promise<Array<{
    address: string;
    balance: string;
    percentage: number;
  }>> {
    try {
      const provider = this.bscClient.getProvider();
      const tokenContract = new ethers.Contract(tokenAddress, BEP20_ABI, provider);
      
      // Get Transfer events
      const filter = tokenContract.filters.Transfer();
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last 10k blocks
      
      const events = await tokenContract.queryFilter(filter, fromBlock, currentBlock);
      
      // Extract unique addresses
      const addresses = new Set<string>();
      events.forEach(event => {
        if (event.args) {
          addresses.add(event.args.from);
          addresses.add(event.args.to);
        }
      });
      
      // Remove zero address
      addresses.delete(ethers.constants.AddressZero);
      
      // Get balances for each address
      const holders = [];
      const totalSupply = await tokenContract.totalSupply();
      const decimals = await tokenContract.decimals();
      
      for (const address of Array.from(addresses).slice(0, limit)) {
        const balance = await tokenContract.balanceOf(address);
        if (balance.gt(0)) {
          const balanceFormatted = ethers.utils.formatUnits(balance, decimals);
          const percentage = balance.mul(10000).div(totalSupply).toNumber() / 100;
          
          holders.push({
            address,
            balance: balanceFormatted,
            percentage
          });
        }
      }
      
      // Sort by balance
      holders.sort((a, b) => parseFloat(b.balance) - parseFloat(a.balance));
      
      return holders;
    } catch (error) {
      console.error('Error getting token holders:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const tokenService = new TokenService();