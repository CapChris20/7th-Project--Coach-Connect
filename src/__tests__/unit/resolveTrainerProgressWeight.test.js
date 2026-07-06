import {
  resolveTrainerProgressCurrentWeight,
  resolveTrainerProgressBeforeWeight,
} from '../../trainer-app/progress-tab/resolveTrainerProgressWeight';

describe('resolveTrainerProgressWeight', () => {
  it('prefers today log, then recent log, then profile weight', () => {
    expect(
      resolveTrainerProgressCurrentWeight({
        todayDashboardWeight: 172,
        latestLoggedWeight: 170,
        profileWeight: 183,
      }),
    ).toBe(172);

    expect(
      resolveTrainerProgressCurrentWeight({
        todayDashboardWeight: null,
        latestLoggedWeight: 170,
        profileWeight: 183,
      }),
    ).toBe(170);

    expect(
      resolveTrainerProgressCurrentWeight({
        todayDashboardWeight: null,
        latestLoggedWeight: null,
        profileWeight: 145,
      }),
    ).toBe(145);
  });

  it('shows different profile weights per client when logs are empty', () => {
    const clientA = resolveTrainerProgressCurrentWeight({
      latestLoggedWeight: null,
      profileWeight: 183,
    });
    const clientB = resolveTrainerProgressCurrentWeight({
      latestLoggedWeight: null,
      profileWeight: 145,
    });
    expect(clientA).toBe(183);
    expect(clientB).toBe(145);
    expect(clientA).not.toBe(clientB);
  });

  it('does not reuse another client logged weight when profile differs', () => {
    expect(
      resolveTrainerProgressCurrentWeight({
        latestLoggedWeight: 170,
        profileWeight: 198,
      }),
    ).toBe(170);

    expect(
      resolveTrainerProgressCurrentWeight({
        latestLoggedWeight: null,
        profileWeight: 198,
      }),
    ).toBe(198);
  });

  it('resolves baseline from starting weight first', () => {
    expect(
      resolveTrainerProgressBeforeWeight({
        startingWeight: 200,
        profileWeight: 170,
      }),
    ).toBe(200);
  });
});
