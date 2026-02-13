const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deploy a second MockERC20 (TST2), mint to TreasuryController,
 * and set 50/50 target allocations for TST and TST2.
 *
 * Run:
 *   PRIVATE_KEY=<your-key> npx hardhat run scripts/setup-two-token-demo.js --network bnbTestnet
 */

function loadDeployments(networkName) {
  const file = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployments file not found: ${file}`);
  }
  return { file, data: JSON.parse(fs.readFileSync(file, "utf-8")) };
}

async function main() {
  console.log("Setting up two-token demo...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const { file, data } = loadDeployments(hre.network.name);
  const treasuryAddress = data.contracts?.TreasuryController;
  const mockToken1 = data.contracts?.MockERC20;

  if (!treasuryAddress || !mockToken1) {
    throw new Error("Missing TreasuryController or MockERC20 in deployments file.");
  }

  // 1) Deploy MockERC20 #2
  console.log("\n1. Deploying MockERC20 (TST2)...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mock2 = await MockERC20.deploy("Test Token 2", "TST2", 18);
  await mock2.waitForDeployment();
  const mock2Address = await mock2.getAddress();
  console.log("   MockERC20 #2 deployed to:", mock2Address);

  // 2) Mint both tokens to treasury
  console.log("\n2. Minting tokens to TreasuryController...");
  const mintAmount = hre.ethers.parseEther("100000"); // 100,000 tokens each

  const mock1 = await hre.ethers.getContractAt("MockERC20", mockToken1);
  const tx1 = await mock1.mint(treasuryAddress, mintAmount);
  await tx1.wait();
  console.log("   Minted 100,000 TST to treasury");

  const tx2 = await mock2.mint(treasuryAddress, mintAmount);
  await tx2.wait();
  console.log("   Minted 100,000 TST2 to treasury");

  // 3) Set target allocations 50/50
  console.log("\n3. Setting target allocations (50/50)...");
  const treasury = await hre.ethers.getContractAt("TreasuryController", treasuryAddress);
  await treasury.setTargetAllocation(mockToken1, 5000);
  await treasury.setTargetAllocation(mock2Address, 5000);
  console.log("   Target allocations set");

  // 4) Update deployments file
  data.contracts.MockERC20_2 = mock2Address;
  data.config = data.config || {};
  data.config.targetAllocations = {
    [mockToken1]: "5000",
    [mock2Address]: "5000",
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`\nUpdated deployments file: ${file}`);

  console.log("\nDone.");
  console.log(`MockERC20 #1: ${mockToken1}`);
  console.log(`MockERC20 #2: ${mock2Address}`);
  console.log(`Treasury: ${treasuryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
