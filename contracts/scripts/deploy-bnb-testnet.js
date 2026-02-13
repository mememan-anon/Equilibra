const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying AegisTreasury contracts to BNB Testnet...");
  console.log("Network:", hre.network.name);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "tBNB");

  if (balance < hre.ethers.parseEther("0.01")) {
    throw new Error("Insufficient tBNB balance for deployment. Need at least 0.01 tBNB.");
  }

  // 1. Deploy Guardian
  console.log("\n1. Deploying Guardian...");
  const Guardian = await hre.ethers.getContractFactory("Guardian");
  const guardian = await Guardian.deploy(deployer.address);
  await guardian.waitForDeployment();
  const guardianAddress = await guardian.getAddress();
  console.log("   Guardian deployed to:", guardianAddress);

  // 2. Deploy TreasuryController
  console.log("\n2. Deploying TreasuryController...");
  const TreasuryController = await hre.ethers.getContractFactory("TreasuryController");
  const treasury = await TreasuryController.deploy(guardianAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("   TreasuryController deployed to:", treasuryAddress);

  // 3. Set TreasuryController in Guardian
  console.log("\n3. Configuring Guardian...");
  const tx1 = await guardian.setTreasuryController(treasuryAddress);
  const receipt1 = await tx1.wait();
  console.log("   Guardian configured with TreasuryController (gas:", receipt1.gasUsed.toString(), ")");

  // 4. Deploy ExampleStrategy
  console.log("\n4. Deploying ExampleStrategy...");
  const ExampleStrategy = await hre.ethers.getContractFactory("ExampleStrategy");
  const strategy = await ExampleStrategy.deploy(treasuryAddress);
  await strategy.waitForDeployment();
  const strategyAddress = await strategy.getAddress();
  console.log("   ExampleStrategy deployed to:", strategyAddress);

  // 5. Configure TreasuryController
  console.log("\n5. Configuring TreasuryController...");

  // Set relayer (use deployer for demo)
  const tx2 = await treasury.setRelayer(deployer.address);
  const receipt2 = await tx2.wait();
  console.log("   Relayer set to:", deployer.address, "(gas:", receipt2.gasUsed.toString(), ")");

  // Whitelist the strategy
  const tx3 = await treasury.setStrategy(strategyAddress, true);
  const receipt3 = await tx3.wait();
  console.log("   Strategy whitelisted:", strategyAddress, "(gas:", receipt3.gasUsed.toString(), ")");

  // 6. Deploy MockERC20 for testing
  console.log("\n6. Deploying MockERC20...");
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20");
  const mockToken = await MockERC20.deploy("Test Token", "TST", 18);
  await mockToken.waitForDeployment();
  const tokenAddress = await mockToken.getAddress();
  console.log("   MockERC20 deployed to:", tokenAddress);

  // 7. Set target allocation for native token (BNB)
  console.log("\n7. Setting target allocations...");
  const nativeToken = "0x0000000000000000000000000000000000000000";
  const tx4 = await treasury.setTargetAllocation(nativeToken, 5000); // 50%
  await tx4.wait();
  console.log("   BNB target allocation set to 50%");

  const tx5 = await treasury.setTargetAllocation(tokenAddress, 5000); // 50%
  await tx5.wait();
  console.log("   TST target allocation set to 50%");

  const finalBalance = await hre.ethers.provider.getBalance(deployer.address);
  const spent = balance - finalBalance;

  console.log("\n========================================");
  console.log("  BNB Testnet Deployment Complete!");
  console.log("========================================");

  const deploymentInfo = {
    network: "bnbTestnet",
    chainId: "97",
    deployer: deployer.address,
    contracts: {
      Guardian: guardianAddress,
      TreasuryController: treasuryAddress,
      ExampleStrategy: strategyAddress,
      MockERC20: tokenAddress,
    },
    config: {
      relayer: deployer.address,
      targetAllocations: {
        [nativeToken]: "5000",
        [tokenAddress]: "5000",
      },
    },
    explorerUrls: {
      Guardian: `https://testnet.bscscan.com/address/${guardianAddress}`,
      TreasuryController: `https://testnet.bscscan.com/address/${treasuryAddress}`,
      ExampleStrategy: `https://testnet.bscscan.com/address/${strategyAddress}`,
      MockERC20: `https://testnet.bscscan.com/address/${tokenAddress}`,
    },
    gasSpent: hre.ethers.formatEther(spent) + " tBNB",
    deployedAt: new Date().toISOString(),
  };

  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, "bnbTestnet.json");
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`\nDeployment info saved to: ${deploymentFile}`);

  console.log("\nView on BSCScan:");
  Object.entries(deploymentInfo.explorerUrls).forEach(([name, url]) => {
    console.log(`  ${name}: ${url}`);
  });

  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
