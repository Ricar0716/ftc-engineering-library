package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.eventloop.opmode.TeleOp;

/**
 * Fictional FTC Open Library seed example. This class is never executed by the
 * platform. It exists so code previews have a legally safe sample file.
 */
@TeleOp(name = "Example TeleOp")
public class ExampleTeleOp extends LinearOpMode {
    @Override
    public void runOpMode() throws InterruptedException {
        waitForStart();

        while (opModeIsActive()) {
            telemetry.addLine("Example only");
            telemetry.update();
        }
    }
}
