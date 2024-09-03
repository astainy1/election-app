
const voterImage = document.querySelector('.candidateInputImage');
const voterImageName = document.querySelector('.candidateImageName');

const candidateImage = document.querySelector('.candidateInputImage');
const candidateImageName = document.querySelector('.voterImageName');

const partyLogoName = document.querySelector('.partyLogoName');
const inputPartyLogo = document.querySelector('.inputPartyLogo');
// const partyName = document.querySelector('#party-name');
// const btn = document.querySelector('#submit');

//display image name uponload
document.addEventListener('DOMContentLoaded', () => {
    
    voterImage.addEventListener('change', () => {
        if(voterImage.files.length > 0){
            voterImageName.textContent = voterImage.files[0].name
        }else{
            voterImageName.textContent = 'Choose image'
        }
    });

    voterImage.addEventListener('change', () => {
        if(voterImage.files.length > 0){
            voterImageName.textContent = voterImage.files[0].name
        }else{
            voterImageName.textContent = 'Choose image'
        }
    });
    inputPartyLogo.addEventListener('change', () => {
        if(inputPartyLogo.files.length > 0){
            partyLogoName.textContent = inputPartyLogo.files[0].name
        }else{
            partyLogoName.textContent = 'Choose image'
        }
    });


});
