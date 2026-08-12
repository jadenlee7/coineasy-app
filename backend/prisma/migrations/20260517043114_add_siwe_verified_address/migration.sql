-- AlterTable
ALTER TABLE "User" ADD COLUMN     "siweChainId" INTEGER,
ADD COLUMN     "verifiedAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_verifiedAddress_key" ON "User"("verifiedAddress");

