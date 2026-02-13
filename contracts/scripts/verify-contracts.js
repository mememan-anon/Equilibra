const hre = require("hardhat");

// Deployed contract addresses (BNB Testnet - 2026-02-13)
const CONTRACTS = {
  Guardian: {
    address: "0x1073064f7D11fce512337018cD351578aA39eD77",
    // constructor(address _treasuryController) — initially deployer address
    constructorArgs: ["0xde70F44bE59359d07153c3a3bA32bA3C0cDA2854"],
  },
  TreasuryController: {
    address: "0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456",
    // constructor(address _guardian)
    constructorArgs: ["0x1073064f7D11fce512337018cD351578aA39eD77"],
  },
  ExampleStrategy: {
    address: "0x3B60eA02752D6C7221F4e7f315066f9969aBC903",
    // constructor(address _treasury)
    constructorArgs: ["0x0a376e8E8E3dcda4Adb898f17cF43bC2dc388456"],
  },
  MockERC20: {
    address: "0xC35D40596389d4FCA0c59849DA01a51e522Ec708",
    // constructor(string name, string symbol, uint8 decimalsValue)
    constructorArgs: ["Test Token", "TST", 18],
  },
};

async function main() {
  console.log("Verifying contracts on BscScan Testnet...\n");

  for (const [name, info] of Object.entries(CONTRACTS)) {
    console.log(`Verifying ${name} at ${info.address}...`);
    try {
      await hre.run("verify:verify", {
        address: info.address,
        constructorArguments: info.constructorArgs,
      });
      console.log(`  ✓ ${name} verified successfully\n`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`  ✓ ${name} already verified\n`);
      } else {
        console.error(`  ✗ ${name} verification failed: ${error.message}\n`);
      }
    }
  }

  console.log("Verification complete!");
  console.log("\nView on BscScan:");
  for (const [name, info] of Object.entries(CONTRACTS)) {
    console.log(`  ${name}: https://testnet.bscscan.com/address/${info.address}#code`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
