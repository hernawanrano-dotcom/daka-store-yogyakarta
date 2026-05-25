import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WithdrawService } from './withdraw.service';

@Controller('api/v1')
export class LedgerController {
  constructor(
    private walletService: WalletService,
    private withdrawService: WithdrawService,
  ) {}

  @Get('wallet/me')
  async getMyWallet(@Req() req: any) {
    // Assume user sudah di-inject oleh auth guard
    const userId = req.user?.id;

    const wallet = await this.walletService.getWalletByUserId(userId);

    return {
      success: true,
      message: 'Wallet retrieved',
      data: {
        balance: wallet.balance,
        pendingBalance: wallet.pending_balance || 0,
        withdrawnBalance: wallet.withdrawn_balance || 0,
      },
    };
  }

  @Get('wallet/transactions')
  async getWalletTransactions(
    @Req() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const userId = req.user?.id;
    const wallet = await this.walletService.getWalletByUserId(userId);

    const result = await this.walletService.getTransactionHistory(
      wallet.id,
      parseInt(page),
      parseInt(limit),
    );

    return {
      success: true,
      message: 'Transactions retrieved',
      data: result.data,
      meta: result.meta,
    };
  }

  @Post('wallet/withdraw')
  async requestWithdraw(
    @Req() req: any,
    @Body() body: {
      amount: number;
      bankName: string;
      bankAccount: string;
      bankAccountName: string;
    },
  ) {
    const userId = req.user?.id;

    const withdraw = await this.withdrawService.requestWithdraw(
      userId,
      body.amount,
      body.bankName,
      body.bankAccount,
      body.bankAccountName,
    );

    return {
      success: true,
      message: 'Withdraw request submitted',
      data: {
        withdrawId: withdraw.id,
        status: withdraw.status,
      },
    };
  }
}