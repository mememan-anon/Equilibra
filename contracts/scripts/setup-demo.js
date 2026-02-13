const hre = require("hardhat");

/**
 * Setup script: Mints MockERC20 tokens to the TreasuryController
 * so the deposit → strategy flow can produce real on-chain txHashes.
 *
 * Run: PRIVATE_KEY=<your-key> npx hardhat run scripts/setup-demo.js --network bnbTestnet
 */

const TREASURY_CONTROLLER = "0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456";
const MOCK_TOKEN = "0xC35D40596389d4FCA0c59849DA01a51e522Ec708";
const EXAMPLE_STRATEGY = "0x3B60eA02752D6C7221F4e7f315066f9969aBC903";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Running setup with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "tBNB\n");

  // 1. Mint MockERC20 tokens to TreasuryController
  const mockToken = await hre.ethers.getContractAt("MockERC20", MOCK_TOKEN);
  const mintAmount = hre.ethers.parseEther("100000"); // 100,000 TST tokens

  console.log("1. Minting 100,000 TST tokens to TreasuryController...");
  const tx1 = await mockToken.mint(TREASURY_CONTROLLER, mintAmount);
  const receipt1 = await tx1.wait();
  console.log(`   ✓ Minted! tx: ${tx1.hash}`);
  console.log(`   Gas used: ${receipt1.gasUsed.toString()}`);

  // Verify balance
  const treasuryBalance = await mockToken.balanceOf(TREASURY_CONTROLLER);
  console.log(`   Treasury TST balance: ${hre.ethers.formatEther(treasuryBalance)} TST\n`);

  // 2. Check strategy is whitelisted
  const treasury = await hre.ethers.getContractAt("TreasuryController", TREASURY_CONTROLLER);
  const isWhitelisted = await treasury.strategies(EXAMPLE_STRATEGY);
  console.log(`2. ExampleStrategy whitelisted: ${isWhitelisted}`);

  // 3. Check relayer is set
  const relayer = await treasury.relayer();
  console.log(`3. Relayer address: ${relayer}`);
  console.log(`   Matches deployer: ${relayer.toLowerCase() === deployer.address.toLowerCase()}\n`);

  // 4. Check native BNB balance of treasury
  const bnbBalance = await hre.ethers.provider.getBalance(TREASURY_CONTROLLER);
  console.log(`4. Treasury native BNB: ${hre.ethers.formatEther(bnbBalance)} tBNB\n`);

  console.log("========================================");
  console.log("  Demo Setup Complete!");
  console.log("========================================");
  console.log(`\nMockERC20 (TST): ${MOCK_TOKEN}`);
  console.log(`Treasury holds: ${hre.ethers.formatEther(treasuryBalance)} TST`);
  console.log(`\nYou can now create a deposit proposal in the UI:`);
  console.log(`  Token: ${MOCK_TOKEN}`);
  console.log(`  Amount: 1000000000000000000000 (1000 TST in wei)`);
  console.log(`  Strategy: ${EXAMPLE_STRATEGY}`);
  console.log(`  Type: deposit`);
  console.log(`\nThis will produce a real on-chain txHash on BNB Testnet.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
