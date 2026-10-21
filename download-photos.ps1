# Downloads your Etsy listing photos into the website's images folder.
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$dir = Join-Path $PSScriptRoot "images"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$photos = @(
  @("4400699248-1.jpg","https://i.etsystatic.com/55332613/r/il/fba132/7860050976/il_794xN.7860050976_fkd0.jpg","https://i.etsystatic.com/55332613/r/il/fba132/7860050976/il_fullxfull.7860050976_fkd0.jpg"),
  @("4400699248-2.jpg","https://i.etsystatic.com/55332613/r/il/7f599e/7417734181/il_794xN.7417734181_7po6.jpg","https://i.etsystatic.com/55332613/r/il/7f599e/7417734181/il_fullxfull.7417734181_7po6.jpg"),
  @("4400699248-3.jpg","https://i.etsystatic.com/55332613/r/il/5304f3/7908003121/il_794xN.7908003121_aqwf.jpg","https://i.etsystatic.com/55332613/r/il/5304f3/7908003121/il_fullxfull.7908003121_aqwf.jpg"),
  @("4400699248-4.jpg","https://i.etsystatic.com/55332613/r/il/f6fbc2/7860050932/il_794xN.7860050932_cpgv.jpg","https://i.etsystatic.com/55332613/r/il/f6fbc2/7860050932/il_fullxfull.7860050932_cpgv.jpg"),
  @("4400699248-5.jpg","https://i.etsystatic.com/55332613/r/il/6ba296/7860050940/il_794xN.7860050940_1qa6.jpg","https://i.etsystatic.com/55332613/r/il/6ba296/7860050940/il_fullxfull.7860050940_1qa6.jpg"),
  @("4400699248-6.jpg","https://i.etsystatic.com/55332613/r/il/6d77ce/7860050972/il_794xN.7860050972_iq8j.jpg","https://i.etsystatic.com/55332613/r/il/6d77ce/7860050972/il_fullxfull.7860050972_iq8j.jpg"),
  @("4400699248-7.jpg","https://i.etsystatic.com/55332613/r/il/5f89ec/7908003127/il_794xN.7908003127_a83a.jpg","https://i.etsystatic.com/55332613/r/il/5f89ec/7908003127/il_fullxfull.7908003127_a83a.jpg"),
  @("4334356976-1.jpg","https://i.etsystatic.com/55332613/r/il/25c904/7014514832/il_794xN.7014514832_hlhb.jpg","https://i.etsystatic.com/55332613/r/il/25c904/7014514832/il_fullxfull.7014514832_hlhb.jpg"),
  @("4334356976-2.jpg","https://i.etsystatic.com/55332613/r/il/73c883/7062492117/il_794xN.7062492117_5aov.jpg","https://i.etsystatic.com/55332613/r/il/73c883/7062492117/il_fullxfull.7062492117_5aov.jpg"),
  @("4334356976-3.jpg","https://i.etsystatic.com/55332613/r/il/459bc4/7062492111/il_794xN.7062492111_er51.jpg","https://i.etsystatic.com/55332613/r/il/459bc4/7062492111/il_fullxfull.7062492111_er51.jpg"),
  @("4334356976-4.jpg","https://i.etsystatic.com/55332613/r/il/57b5ee/7014514810/il_794xN.7014514810_2kdz.jpg","https://i.etsystatic.com/55332613/r/il/57b5ee/7014514810/il_fullxfull.7014514810_2kdz.jpg"),
  @("4334356976-5.jpg","https://i.etsystatic.com/55332613/r/il/c7416d/7062492083/il_794xN.7062492083_3mpc.jpg","https://i.etsystatic.com/55332613/r/il/c7416d/7062492083/il_fullxfull.7062492083_3mpc.jpg"),
  @("4509881976-1.jpg","https://i.etsystatic.com/55332613/r/il/c202b6/8099005817/il_794xN.8099005817_de84.jpg","https://i.etsystatic.com/55332613/r/il/c202b6/8099005817/il_fullxfull.8099005817_de84.jpg"),
  @("4509881976-2.jpg","https://i.etsystatic.com/55332613/r/il/c659a1/8051093366/il_794xN.8051093366_c841.jpg","https://i.etsystatic.com/55332613/r/il/c659a1/8051093366/il_fullxfull.8051093366_c841.jpg"),
  @("4509881976-3.jpg","https://i.etsystatic.com/55332613/r/il/95c2a1/8051093358/il_794xN.8051093358_bk84.jpg","https://i.etsystatic.com/55332613/r/il/95c2a1/8051093358/il_fullxfull.8051093358_bk84.jpg"),
  @("4509881976-4.jpg","https://i.etsystatic.com/55332613/r/il/b7b709/8051093344/il_794xN.8051093344_g0z3.jpg","https://i.etsystatic.com/55332613/r/il/b7b709/8051093344/il_fullxfull.8051093344_g0z3.jpg"),
  @("4509881976-5.jpg","https://i.etsystatic.com/55332613/r/il/7f5711/8099005789/il_794xN.8099005789_lo0g.jpg","https://i.etsystatic.com/55332613/r/il/7f5711/8099005789/il_fullxfull.8099005789_lo0g.jpg"),
  @("4509881976-6.jpg","https://i.etsystatic.com/55332613/r/il/de3d90/8099005811/il_794xN.8099005811_kaab.jpg","https://i.etsystatic.com/55332613/r/il/de3d90/8099005811/il_fullxfull.8099005811_kaab.jpg"),
  @("4469254514-1.jpg","https://i.etsystatic.com/55332613/r/il/b05f4b/7835470023/il_794xN.7835470023_bn7e.jpg","https://i.etsystatic.com/55332613/r/il/b05f4b/7835470023/il_fullxfull.7835470023_bn7e.jpg"),
  @("4469254514-2.jpg","https://i.etsystatic.com/55332613/r/il/b6f167/7835398129/il_794xN.7835398129_t0il.jpg","https://i.etsystatic.com/55332613/r/il/b6f167/7835398129/il_fullxfull.7835398129_t0il.jpg"),
  @("4469254514-3.jpg","https://i.etsystatic.com/55332613/r/il/4dfd26/7787468786/il_794xN.7787468786_7gfq.jpg","https://i.etsystatic.com/55332613/r/il/4dfd26/7787468786/il_fullxfull.7787468786_7gfq.jpg"),
  @("4469254514-4.jpg","https://i.etsystatic.com/55332613/r/il/16eb0a/7835398127/il_794xN.7835398127_azsl.jpg","https://i.etsystatic.com/55332613/r/il/16eb0a/7835398127/il_fullxfull.7835398127_azsl.jpg"),
  @("4469254514-5.jpg","https://i.etsystatic.com/55332613/r/il/7a29ad/7835398149/il_794xN.7835398149_9lag.jpg","https://i.etsystatic.com/55332613/r/il/7a29ad/7835398149/il_fullxfull.7835398149_9lag.jpg"),
  @("4395297309-1.jpg","https://i.etsystatic.com/55332613/r/il/338662/7406028031/il_794xN.7406028031_8w63.jpg","https://i.etsystatic.com/55332613/r/il/338662/7406028031/il_fullxfull.7406028031_8w63.jpg"),
  @("4395297309-2.jpg","https://i.etsystatic.com/55332613/r/il/37fa76/7337058314/il_794xN.7337058314_qwfg.jpg","https://i.etsystatic.com/55332613/r/il/37fa76/7337058314/il_fullxfull.7337058314_qwfg.jpg"),
  @("4395297309-3.jpg","https://i.etsystatic.com/55332613/r/il/49d6d3/7337058322/il_794xN.7337058322_jm64.jpg","https://i.etsystatic.com/55332613/r/il/49d6d3/7337058322/il_fullxfull.7337058322_jm64.jpg"),
  @("4395297309-4.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_794xN.7337058364_2oaf.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_fullxfull.7337058364_2oaf.jpg"),
  @("4395297309-5.jpg","https://i.etsystatic.com/55332613/r/il/a5d1b2/7337058306/il_794xN.7337058306_rcq0.jpg","https://i.etsystatic.com/55332613/r/il/a5d1b2/7337058306/il_fullxfull.7337058306_rcq0.jpg"),
  @("4395297309-6.jpg","https://i.etsystatic.com/55332613/r/il/e8b234/7337058392/il_794xN.7337058392_o9uk.jpg","https://i.etsystatic.com/55332613/r/il/e8b234/7337058392/il_fullxfull.7337058392_o9uk.jpg"),
  @("4506184298-1.jpg","https://i.etsystatic.com/55332613/r/il/3aa2c6/8026477544/il_794xN.8026477544_gaq1.jpg","https://i.etsystatic.com/55332613/r/il/3aa2c6/8026477544/il_fullxfull.8026477544_gaq1.jpg"),
  @("4506184298-2.jpg","https://i.etsystatic.com/55332613/r/il/947927/8026477534/il_794xN.8026477534_maqw.jpg","https://i.etsystatic.com/55332613/r/il/947927/8026477534/il_fullxfull.8026477534_maqw.jpg"),
  @("4506184298-3.jpg","https://i.etsystatic.com/55332613/r/il/e7bbe8/8074391107/il_794xN.8074391107_g079.jpg","https://i.etsystatic.com/55332613/r/il/e7bbe8/8074391107/il_fullxfull.8074391107_g079.jpg"),
  @("4297972451-1.jpg","https://i.etsystatic.com/55332613/r/il/102545/7907973235/il_794xN.7907973235_1ll2.jpg","https://i.etsystatic.com/55332613/r/il/102545/7907973235/il_fullxfull.7907973235_1ll2.jpg"),
  @("4297972451-2.jpg","https://i.etsystatic.com/55332613/r/il/03833a/7860020942/il_794xN.7860020942_59w4.jpg","https://i.etsystatic.com/55332613/r/il/03833a/7860020942/il_fullxfull.7860020942_59w4.jpg"),
  @("4297972451-3.jpg","https://i.etsystatic.com/55332613/r/il/b68f30/7907973213/il_794xN.7907973213_16xm.jpg","https://i.etsystatic.com/55332613/r/il/b68f30/7907973213/il_fullxfull.7907973213_16xm.jpg"),
  @("4297972451-4.jpg","https://i.etsystatic.com/55332613/r/il/28541a/6824809142/il_794xN.6824809142_3ij4.jpg","https://i.etsystatic.com/55332613/r/il/28541a/6824809142/il_fullxfull.6824809142_3ij4.jpg"),
  @("4297972451-5.jpg","https://i.etsystatic.com/55332613/r/il/855c83/6824809136/il_794xN.6824809136_mbg5.jpg","https://i.etsystatic.com/55332613/r/il/855c83/6824809136/il_fullxfull.6824809136_mbg5.jpg"),
  @("4297972451-6.jpg","https://i.etsystatic.com/55332613/r/il/b61966/7860020880/il_794xN.7860020880_trd2.jpg","https://i.etsystatic.com/55332613/r/il/b61966/7860020880/il_fullxfull.7860020880_trd2.jpg"),
  @("4297972451-7.jpg","https://i.etsystatic.com/55332613/r/il/d91bf2/7907973209/il_794xN.7907973209_3v5q.jpg","https://i.etsystatic.com/55332613/r/il/d91bf2/7907973209/il_fullxfull.7907973209_3v5q.jpg"),
  @("4404334893-1.jpg","https://i.etsystatic.com/55332613/r/il/dd1476/7440912875/il_794xN.7440912875_n8t6.jpg","https://i.etsystatic.com/55332613/r/il/dd1476/7440912875/il_fullxfull.7440912875_n8t6.jpg"),
  @("4404334893-2.jpg","https://i.etsystatic.com/55332613/r/il/2d7ba0/7440912843/il_794xN.7440912843_p9fr.jpg","https://i.etsystatic.com/55332613/r/il/2d7ba0/7440912843/il_fullxfull.7440912843_p9fr.jpg"),
  @("4404334893-3.jpg","https://i.etsystatic.com/55332613/r/il/aac6cf/7440912781/il_794xN.7440912781_644r.jpg","https://i.etsystatic.com/55332613/r/il/aac6cf/7440912781/il_fullxfull.7440912781_644r.jpg"),
  @("4404334893-4.jpg","https://i.etsystatic.com/55332613/r/il/35c98e/7393021082/il_794xN.7393021082_q0vx.jpg","https://i.etsystatic.com/55332613/r/il/35c98e/7393021082/il_fullxfull.7393021082_q0vx.jpg"),
  @("4404334893-5.jpg","https://i.etsystatic.com/55332613/r/il/3397b5/7440935787/il_794xN.7440935787_eosj.jpg","https://i.etsystatic.com/55332613/r/il/3397b5/7440935787/il_fullxfull.7440935787_eosj.jpg"),
  @("4404334893-6.jpg","https://i.etsystatic.com/55332613/r/il/fbc988/7392997844/il_794xN.7392997844_hd1n.jpg","https://i.etsystatic.com/55332613/r/il/fbc988/7392997844/il_fullxfull.7392997844_hd1n.jpg"),
  @("4404334893-7.jpg","https://i.etsystatic.com/55332613/r/il/231603/7392997796/il_794xN.7392997796_59on.jpg","https://i.etsystatic.com/55332613/r/il/231603/7392997796/il_fullxfull.7392997796_59on.jpg"),
  @("4328837116-1.jpg","https://i.etsystatic.com/55332613/r/il/844b0e/7860356574/il_794xN.7860356574_qxzg.jpg","https://i.etsystatic.com/55332613/r/il/844b0e/7860356574/il_fullxfull.7860356574_qxzg.jpg"),
  @("4328837116-2.jpg","https://i.etsystatic.com/55332613/r/il/7b4b0f/7860356598/il_794xN.7860356598_e8lq.jpg","https://i.etsystatic.com/55332613/r/il/7b4b0f/7860356598/il_fullxfull.7860356598_e8lq.jpg"),
  @("4328837116-3.jpg","https://i.etsystatic.com/55332613/r/il/ff225e/7860356468/il_794xN.7860356468_p4j6.jpg","https://i.etsystatic.com/55332613/r/il/ff225e/7860356468/il_fullxfull.7860356468_p4j6.jpg"),
  @("4328837116-4.jpg","https://i.etsystatic.com/55332613/r/il/5f7591/7860356556/il_794xN.7860356556_4hzw.jpg","https://i.etsystatic.com/55332613/r/il/5f7591/7860356556/il_fullxfull.7860356556_4hzw.jpg"),
  @("4328837116-5.jpg","https://i.etsystatic.com/55332613/r/il/c10195/7860356488/il_794xN.7860356488_g03m.jpg","https://i.etsystatic.com/55332613/r/il/c10195/7860356488/il_fullxfull.7860356488_g03m.jpg"),
  @("4328837116-6.jpg","https://i.etsystatic.com/55332613/r/il/4aeb86/7860356590/il_794xN.7860356590_msuc.jpg","https://i.etsystatic.com/55332613/r/il/4aeb86/7860356590/il_fullxfull.7860356590_msuc.jpg"),
  @("4405548763-1.jpg","https://i.etsystatic.com/55332613/r/il/22eb35/7448400807/il_794xN.7448400807_618s.jpg","https://i.etsystatic.com/55332613/r/il/22eb35/7448400807/il_fullxfull.7448400807_618s.jpg"),
  @("4405548763-2.jpg","https://i.etsystatic.com/55332613/r/il/149084/7400485688/il_794xN.7400485688_r8u1.jpg","https://i.etsystatic.com/55332613/r/il/149084/7400485688/il_fullxfull.7400485688_r8u1.jpg"),
  @("4405548763-3.jpg","https://i.etsystatic.com/55332613/r/il/1bb6bf/7400485754/il_794xN.7400485754_7470.jpg","https://i.etsystatic.com/55332613/r/il/1bb6bf/7400485754/il_fullxfull.7400485754_7470.jpg"),
  @("4405548763-4.jpg","https://i.etsystatic.com/55332613/r/il/161214/7448400713/il_794xN.7448400713_r4we.jpg","https://i.etsystatic.com/55332613/r/il/161214/7448400713/il_fullxfull.7448400713_r4we.jpg"),
  @("4405548763-5.jpg","https://i.etsystatic.com/55332613/r/il/07271d/7400485702/il_794xN.7400485702_rach.jpg","https://i.etsystatic.com/55332613/r/il/07271d/7400485702/il_fullxfull.7400485702_rach.jpg"),
  @("4405548763-6.jpg","https://i.etsystatic.com/55332613/r/il/3f73d1/7400485712/il_794xN.7400485712_tmjj.jpg","https://i.etsystatic.com/55332613/r/il/3f73d1/7400485712/il_fullxfull.7400485712_tmjj.jpg"),
  @("4459515700-1.jpg","https://i.etsystatic.com/55332613/r/il/5c5af3/7863195892/il_794xN.7863195892_38u0.jpg","https://i.etsystatic.com/55332613/r/il/5c5af3/7863195892/il_fullxfull.7863195892_38u0.jpg"),
  @("4459515700-2.jpg","https://i.etsystatic.com/55332613/r/il/02ca35/7863195758/il_794xN.7863195758_e9u7.jpg","https://i.etsystatic.com/55332613/r/il/02ca35/7863195758/il_fullxfull.7863195758_e9u7.jpg"),
  @("4459515700-3.jpg","https://i.etsystatic.com/55332613/r/il/f5f48e/7863195802/il_794xN.7863195802_p6ab.jpg","https://i.etsystatic.com/55332613/r/il/f5f48e/7863195802/il_fullxfull.7863195802_p6ab.jpg"),
  @("4459515700-4.jpg","https://i.etsystatic.com/55332613/r/il/f30ff7/7911147383/il_794xN.7911147383_28wl.jpg","https://i.etsystatic.com/55332613/r/il/f30ff7/7911147383/il_fullxfull.7911147383_28wl.jpg"),
  @("4459515700-5.jpg","https://i.etsystatic.com/55332613/r/il/188cf6/7770123127/il_794xN.7770123127_wuk0.jpg","https://i.etsystatic.com/55332613/r/il/188cf6/7770123127/il_fullxfull.7770123127_wuk0.jpg"),
  @("4459515700-6.jpg","https://i.etsystatic.com/55332613/r/il/1bcef0/7911147253/il_794xN.7911147253_a2jy.jpg","https://i.etsystatic.com/55332613/r/il/1bcef0/7911147253/il_fullxfull.7911147253_a2jy.jpg"),
  @("4459515700-7.jpg","https://i.etsystatic.com/55332613/r/il/2ba5f3/7911147353/il_794xN.7911147353_abcq.jpg","https://i.etsystatic.com/55332613/r/il/2ba5f3/7911147353/il_fullxfull.7911147353_abcq.jpg"),
  @("4459515700-8.jpg","https://i.etsystatic.com/55332613/r/il/6ff32c/7911147385/il_794xN.7911147385_ldw5.jpg","https://i.etsystatic.com/55332613/r/il/6ff32c/7911147385/il_fullxfull.7911147385_ldw5.jpg"),
  @("4509874233-1.jpg","https://i.etsystatic.com/55332613/r/il/d7eb93/8051049974/il_794xN.8051049974_nei6.jpg","https://i.etsystatic.com/55332613/r/il/d7eb93/8051049974/il_fullxfull.8051049974_nei6.jpg"),
  @("4509874233-2.jpg","https://i.etsystatic.com/55332613/r/il/5ff14c/8051049996/il_794xN.8051049996_97td.jpg","https://i.etsystatic.com/55332613/r/il/5ff14c/8051049996/il_fullxfull.8051049996_97td.jpg"),
  @("4509874233-3.jpg","https://i.etsystatic.com/55332613/r/il/a1c17e/8051049984/il_794xN.8051049984_830c.jpg","https://i.etsystatic.com/55332613/r/il/a1c17e/8051049984/il_fullxfull.8051049984_830c.jpg"),
  @("4509874233-4.jpg","https://i.etsystatic.com/55332613/r/il/aaf714/8051049968/il_794xN.8051049968_254e.jpg","https://i.etsystatic.com/55332613/r/il/aaf714/8051049968/il_fullxfull.8051049968_254e.jpg"),
  @("4509874233-5.jpg","https://i.etsystatic.com/55332613/r/il/e862e9/8098962783/il_794xN.8098962783_p94g.jpg","https://i.etsystatic.com/55332613/r/il/e862e9/8098962783/il_fullxfull.8098962783_p94g.jpg"),
  @("4472020335-1.jpg","https://i.etsystatic.com/55332613/r/il/ddb911/7805666296/il_794xN.7805666296_lktk.jpg","https://i.etsystatic.com/55332613/r/il/ddb911/7805666296/il_fullxfull.7805666296_lktk.jpg"),
  @("4472020335-2.jpg","https://i.etsystatic.com/55332613/r/il/aa64c9/7853609285/il_794xN.7853609285_3wun.jpg","https://i.etsystatic.com/55332613/r/il/aa64c9/7853609285/il_fullxfull.7853609285_3wun.jpg"),
  @("4472020335-3.jpg","https://i.etsystatic.com/55332613/r/il/34bfe8/7805666270/il_794xN.7805666270_t303.jpg","https://i.etsystatic.com/55332613/r/il/34bfe8/7805666270/il_fullxfull.7805666270_t303.jpg"),
  @("4472020335-4.jpg","https://i.etsystatic.com/55332613/r/il/b984f0/7805666216/il_794xN.7805666216_3ux5.jpg","https://i.etsystatic.com/55332613/r/il/b984f0/7805666216/il_fullxfull.7805666216_3ux5.jpg"),
  @("4472020335-5.jpg","https://i.etsystatic.com/55332613/r/il/907c72/7805666262/il_794xN.7805666262_fsly.jpg","https://i.etsystatic.com/55332613/r/il/907c72/7805666262/il_fullxfull.7805666262_fsly.jpg"),
  @("4398833045-1.jpg","https://i.etsystatic.com/55332613/r/il/b375d4/7358186236/il_794xN.7358186236_75tq.jpg","https://i.etsystatic.com/55332613/r/il/b375d4/7358186236/il_fullxfull.7358186236_75tq.jpg"),
  @("4398833045-2.jpg","https://i.etsystatic.com/55332613/r/il/cb4eaa/7358181454/il_794xN.7358181454_q2o3.jpg","https://i.etsystatic.com/55332613/r/il/cb4eaa/7358181454/il_fullxfull.7358181454_q2o3.jpg"),
  @("4398833045-3.jpg","https://i.etsystatic.com/55332613/r/il/0a3d3b/7358137622/il_794xN.7358137622_6fg9.jpg","https://i.etsystatic.com/55332613/r/il/0a3d3b/7358137622/il_fullxfull.7358137622_6fg9.jpg"),
  @("4398833045-4.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_794xN.7337058364_2oaf.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_fullxfull.7337058364_2oaf.jpg"),
  @("4398827077-1.jpg","https://i.etsystatic.com/55332613/r/il/184976/7358137604/il_794xN.7358137604_n5op.jpg","https://i.etsystatic.com/55332613/r/il/184976/7358137604/il_fullxfull.7358137604_n5op.jpg"),
  @("4398827077-2.jpg","https://i.etsystatic.com/55332613/r/il/0a3d3b/7358137622/il_794xN.7358137622_6fg9.jpg","https://i.etsystatic.com/55332613/r/il/0a3d3b/7358137622/il_fullxfull.7358137622_6fg9.jpg"),
  @("4398827077-3.jpg","https://i.etsystatic.com/55332613/r/il/4c21b7/7406057649/il_794xN.7406057649_m81p.jpg","https://i.etsystatic.com/55332613/r/il/4c21b7/7406057649/il_fullxfull.7406057649_m81p.jpg"),
  @("4398827077-4.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_794xN.7337058364_2oaf.jpg","https://i.etsystatic.com/55332613/r/il/8ab3dc/7337058364/il_fullxfull.7337058364_2oaf.jpg")
)
$ok = 0; $failed = @()
foreach ($p in $photos) {
  $out = Join-Path $dir $p[0]
  try { Invoke-WebRequest -UseBasicParsing -Uri $p[1] -OutFile $out; $ok++ }
  catch {
    try { Invoke-WebRequest -UseBasicParsing -Uri $p[2] -OutFile $out; $ok++ }
    catch { $failed += $p[0] }
  }
  Write-Host ("Downloaded {0} of {1}" -f $ok, $photos.Count)
}
Write-Host ""
if ($failed.Count -eq 0) { Write-Host "Done. All $ok photos are in the images folder." -ForegroundColor Green }
else { Write-Host ("Done, but these failed: " + ($failed -join ", ")) -ForegroundColor Yellow }
